import { isSupportedCountry, validateCountryPhone } from '../shared/phone';
import {resolvePublicCourse,publicCourses} from './public-courses';
import { registerPortalRoutes } from "./portal";
import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertPostSchema, platformApplications, posts } from "@shared/schema";
import { randomBytes } from "crypto";
import { z } from "zod";
import { Resend } from "resend";
import sanitizeHtml from "sanitize-html";
import { db } from "./db";
import { programs, curriculumModules, curriculumUnits, materials, assignedMaterials, progress, enrollments } from "@shared/schema";
import { eq, and, notInArray, desc } from "drizzle-orm";
import { registerIntegrationRoutes, checkScheduleConflict } from "./integrations/routes";
import { queue, withLock } from "./integrations/service";
import { safeLesson, safeProfile, frontendOrigin, validTimezone } from "./integrations/security";
import { verifyTurnstile } from "./turnstile";
import { notificationStatus, sendNotificationTest } from "./notifications";
import {
  clearSessionCookie,
  getUserFromRequest,
  issueToken,
  requireAuth,
  setSessionCookie,
  tokenHash,
  toAuthUser,
  verifyPassword,
  verifyPasswordAsync,
  hashPasswordAsync,
  type AppRole,
} from "./auth";


const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const notificationTests = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 5;
const LOGIN_IP_LIMIT = 25;

async function turnstile(req: any, token: unknown) {
  return verifyTurnstile(token, req.ip);
}
function oneTimeToken() { return randomBytes(32).toString("base64url"); }
function appUrl(req: any) { return process.env.NODE_ENV === "production" ? frontendOrigin() : process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`; }
async function sendAuthLink(to: string, subject: string, path: string, token: string) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY and RESEND_FROM are required in production");
    return false;
  }
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.RESEND_FROM, to, subject, html: `<p><a rel="noopener noreferrer" target="_blank" href="${path}?token=${encodeURIComponent(token)}">Continue securely</a></p>` });
  if (result.error) throw new Error("Email delivery failed");
  return true;
}

function consumeQuota(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now();
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    if (store.size >= 10_000) {
      for (const [entryKey, entry] of Array.from(store.entries())) {
        if (entry.resetAt <= now || store.size >= 10_000) store.delete(entryKey);
        if (store.size < 10_000) break;
      }
    }
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    next();
  });

  app.get('/api/courses', async(_req,res,next)=>{try{res.json(await publicCourses())}catch(e){next(e)}});
  app.get('/api/courses/:id', async(req,res,next)=>{try{const course=await resolvePublicCourse(String(req.params.id));return course?res.json(course):res.status(404).json({message:'Course not found'});}catch(e){next(e)}});

  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("origin");
    if (!origin) {
      if (req.headers.cookie?.includes("session_token=")) {
        return res.status(403).json({ message: "Request origin is required" });
      }
      return next();
    }
    try {
      const originUrl = new URL(origin);
      const requestProtocol = req.protocol;
      if (originUrl.host !== req.get("host") || originUrl.protocol !== `${requestProtocol}:`) {
        return res.status(403).json({ message: "Cross-origin request rejected" });
      }
    } catch {
      return res.status(403).json({ message: "Invalid request origin" });
    }
    next();
  });

  registerPortalRoutes(app);
  registerIntegrationRoutes(app);

  app.get("/api/admin/notifications/status", requireAuth(["admin"]), (_req, res) => {
    res.json(notificationStatus());
  });
  app.post("/api/admin/notifications/test", requireAuth(["admin"]), async (req, res) => {
    const current = (req as any).auth.user;
    if (!consumeQuota(notificationTests, String(current.id), 3, 60 * 60 * 1000)) return res.status(429).json({ code: "rate_limited" });
    try {
      return res.json(await sendNotificationTest(current.email));
    } catch (error) {
      return res.status(error instanceof Error && error.message === "not_configured" ? 503 : 502)
        .json({ code: error instanceof Error && error.message === "not_configured" ? "not_configured" : "email_delivery_failed" });
    }
  });

  // ── Authentication & role-based dashboards ───────────────────────────────

  app.get("/api/auth/config", (_req, res) => {
    const enabled = Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY);
    res.json({
      enabled,
      siteKey: enabled ? process.env.TURNSTILE_SITE_KEY : undefined,
      developmentBypass: process.env.NODE_ENV === "development" && !enabled,
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const email = z.string().email().parse(req.body.email).toLowerCase();
      const password = z.string().min(1).max(128).parse(req.body.password);
      const challenge = await turnstile(req, req.body.turnstileToken);
      if (!challenge.ok) return res.status(403).json({ message: "Security verification required" });
      const loginKey = `${req.ip}:${email}`;
      const loginIpKey = `${req.ip}:*`;
      if (
        !consumeQuota(loginAttempts, loginIpKey, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS) ||
        !consumeQuota(loginAttempts, loginKey, LOGIN_LIMIT, LOGIN_WINDOW_MS)
      ) {
        return res.status(429).json({ message: "Too many login attempts. Please try again later." });
      }
      const user = await storage.getUserByEmail(email);
      if (user?.lockedUntil && user.lockedUntil > new Date()) {
        return res.status(429).json({ message: "Too many login attempts. Please try again later." });
      }
      if (
        !user ||
        (user.role !== "student" && user.role !== "admin") ||
        user.status !== "active" ||
        (user.role === "student" && !user.emailVerifiedAt) ||
        !(await verifyPasswordAsync(password, user.passwordHash))
      ) {
        if (user && (user.role === "admin" || user.role === "student")) {
          await storage.recordLoginFailure(user.id);
        }
        return res.status(401).json({ message: "Invalid email or password" });
      }
      await storage.updateUser(user.id, {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
      const token = await issueToken(user);
      loginAttempts.delete(loginKey);
      setSessionCookie(res, token);
      res.json({ user: toAuthUser(user) });
    } catch (error: any) {
      res.status(400).json({ message: "Please enter a valid email and password" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    res.status(503).json({
      message: "Student accounts are created through the application and invitation process.",
    });
  });

  app.get("/api/auth/me", requireAuth(), (req, res) => {
    res.json({ user: (req as any).auth.user });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const result = await getUserFromRequest(req);
    if (result) await storage.revokeSession(tokenHash(result.token));
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.post("/api/auth/logout-all", requireAuth(), async (req, res) => {
    await storage.revokeAllSessions((req as any).auth.user.id); clearSessionCookie(res); res.json({ ok: true });
  });
  app.post("/api/auth/forgot-password", async (req, res) => {
    if (!consumeQuota(loginAttempts, `reset:${req.ip}`, 5, LOGIN_WINDOW_MS)) return res.status(429).json({ message: "Too many requests" });
    const challenge = await turnstile(req, req.body.turnstileToken);
    if (!challenge.ok) return res.status(403).json({ message: "Security verification required" });
    const email = z.string().email().parse(req.body.email).toLowerCase();
    const user = await storage.getUserByEmail(email);
    if (user && user.status === "active") {
      const token = oneTimeToken();
      await storage.createResetToken({ userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
      try { await sendAuthLink(email, "Reset your password", `${appUrl(req)}${req.body.locale === "ar" ? "/ar" : ""}/reset-password`, token); }
      catch { console.error("Password-reset email delivery unavailable"); }
    }
    res.json({ message: "If an account exists, a reset link has been sent." });
  });
  app.post("/api/auth/reset-password", async (req, res) => {
    if (!consumeQuota(loginAttempts, `reset-password:${req.ip}`, 10, LOGIN_WINDOW_MS)) return res.status(429).json({ code: "limited" });
    if (!(await turnstile(req, req.body.turnstileToken)).ok) return res.status(403).json({ code: "security" });
    const token = z.string().min(20).max(200).parse(req.body.token); const password = z.string().min(12).max(128).parse(req.body.password);
    const row = await storage.getResetToken(tokenHash(token));
    if (!row || row.expiresAt <= new Date()) return res.status(400).json({ message: "Invalid or expired reset link" });
    if (!await storage.consumeResetToken(row.id)) return res.status(400).json({ message: "Invalid or expired reset link" });
    await storage.updateUser(row.userId, { passwordHash: await hashPasswordAsync(password) });
    await storage.revokeAllSessions(row.userId);
    res.json({ ok: true });
  });
  app.post("/api/auth/accept-invitation", async (req, res) => {
    if (!consumeQuota(loginAttempts, `accept-invitation:${req.ip}`, 10, LOGIN_WINDOW_MS)) return res.status(429).json({ code: "limited" });
    if (!(await turnstile(req, req.body.turnstileToken)).ok) return res.status(403).json({ code: "security" });
    const token = z.string().min(20).max(200).parse(req.body.token); const password = z.string().min(12).max(128).parse(req.body.password);
    const invitation = await storage.getInvitation(tokenHash(token));
    if (!invitation || invitation.expiresAt <= new Date()) return res.status(400).json({ message: "Invalid or expired invitation" });
    const user = await storage.getUser(invitation.userId);
    if (!user || user.role !== "student" || user.status !== "invited") {
      return res.status(400).json({ message: "Invalid invitation" });
    }
    if (!await storage.consumeInvitation(invitation.id)) return res.status(400).json({ message: "Invalid or expired invitation" });
    await storage.updateUser(user.id, {
      passwordHash: await hashPasswordAsync(password),
      emailVerifiedAt: new Date(),
      status: "active",
    });
    res.json({ ok: true });
  });
  app.post("/api/auth/verify-email", async (req, res) => {
    const token = z.string().min(20).max(200).parse(req.body.token); const row = await storage.getVerificationToken(tokenHash(token));
    if (!row || row.expiresAt <= new Date()) return res.status(400).json({ message: "Invalid or expired verification link" });
    const verifyUser = await storage.getUser(row.userId);
    if (!verifyUser || !["active", "invited"].includes(verifyUser.status) || !verifyUser.passwordHash) return res.status(400).json({ message: "This verification link is no longer valid" });
    if (!await storage.consumeVerificationToken(row.id)) return res.status(400).json({ message: "Invalid or expired verification link" });
    await storage.updateUser(row.userId, { emailVerifiedAt: new Date(), status: "active" }); res.json({ ok: true });
  });
  app.post("/api/auth/resend-verification", async (req, res) => {
    if (!consumeQuota(loginAttempts, `verify:${req.ip}`, 5, LOGIN_WINDOW_MS)) return res.status(429).json({ message: "Too many requests" });
    const challenge = await turnstile(req, req.body.turnstileToken);
    if (!challenge.ok) return res.status(403).json({ message: "Security verification required" });
    const email = z.string().email().parse(req.body.email).toLowerCase();
    const user = await storage.getUserByEmail(email);
    if (user && !user.emailVerifiedAt && user.passwordHash && ["active", "invited"].includes(user.status)) {
      const token = oneTimeToken();
      await storage.createVerificationToken({ userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
      try { await sendAuthLink(email, "Verify your email", `${appUrl(req)}${req.body.locale === "ar" ? "/ar" : ""}/verify-email`, token); }
      catch { console.error("Verification email delivery unavailable"); }
    }
    res.json({ message: "If the account is eligible, a verification link will be sent." });
  });
  app.post("/api/auth/change-password", requireAuth(), async (req, res) => {
    const current = z.string().min(1).max(128).parse(req.body.currentPassword); const password = z.string().min(12).max(128).parse(req.body.password);
    const user = await storage.getUser((req as any).auth.user.id);
    if (!user || !(await verifyPasswordAsync(current, user.passwordHash))) return res.status(400).json({ message: "Current password is incorrect" });
    await storage.updateUser(user.id, { passwordHash: await hashPasswordAsync(password) }); await storage.revokeAllSessions(user.id); res.json({ ok: true });
  });

  app.post("/api/applications", async (req, res) => {
    const challenge = await turnstile(req, req.body.turnstileToken); if (!challenge.ok) return res.status(403).json({ message: "Security verification required" });
    const data = z.object({ name: z.string().trim().min(2).max(200), email: z.string().email().transform(v => v.toLowerCase()), phone: z.string().max(30).optional(), country: z.string().max(100).optional(), timezone: z.string().max(80).refine(validTimezone).optional(), preferredLanguage: z.enum(["en", "ar", "English", "Arabic"]).optional(), ageGroup: z.enum(["child", "teenager", "adult"]), requestedProgram: z.string().trim().min(1).max(200), currentExperience: z.string().max(5000), learningGoals: z.string().max(5000), availability: z.string().max(5000).optional() }).parse(req.body);
    if (!data.country || !isSupportedCountry(data.country)) return res.status(400).json({code:'invalidCountry',fieldErrors:{country:'invalidCountry'}});
    const normalizedPhone = validateCountryPhone(data.country, data.phone || '');
    if (!normalizedPhone) return res.status(400).json({code:'invalidCountryPhone',fieldErrors:{phone:'invalidCountryPhone'}});
    data.phone = normalizedPhone.phone;
    if (!(await storage.getCourses()).some(c => c.title === data.requestedProgram)) return res.status(400).json({code:"invalidCourse",message:"Choose an available course"});
    const existing = (await db.select({id:platformApplications.id}).from(platformApplications).where(and(eq(platformApplications.email,data.email),notInArray(platformApplications.status,["rejected","archived"]))).limit(1))[0];
    if (existing) return res.status(409).json({ message: "An application for this email is already in progress." });
    try { const application = await storage.createApplication({ ...data, requestedRole: "student", status: "new" }); res.status(201).json({ application: { id: application.id } }); } catch (e: any) { if ((e.code || e.cause?.code) === "23505") return res.status(409).json({ code: "duplicate" }); throw e; }
  });

  async function recordContext(authUser: { id: number; role: AppRole }) {
    const allUsers = await storage.listUsers();
    const studentIds = authUser.role === "student"
      ? [authUser.id]
      : allUsers.filter(user => user.role === "student").map(user => user.id);

    const [attendance, grades, messages] = await Promise.all([
      storage.listAttendance({ studentIds }),
      storage.listGrades({ studentIds }),
      storage.listMessages(authUser.id),
    ]);
    const userNames = new Map(allUsers.map(user => [user.id, user.name]));
    const messageRecipients = allUsers
      .filter(user => user.status === "active" && user.id !== authUser.id)
      .filter(user => authUser.role === "admin" ? user.role === "student" : user.role === "admin")
      .map(user => ({ id: user.id, name: user.name, role: user.role }));
    return {
      attendance,
      grades,
      messages: messages.map(message => ({
        ...message,
        senderName: userNames.get(message.senderId) || "Academy",
        recipientName: userNames.get(message.recipientId) || "Academy",
      })),
      messageRecipients,
      students: allUsers
        .filter(user => studentIds.includes(user.id))
        .map(user => ({ id: user.id, name: user.name })),
    };
  }

  async function canManageStudent(authUser: { id: number; role: AppRole }, studentId: number) {
    if (authUser.role !== "admin") return false;
    const student = await storage.getUser(studentId);
    return student?.role === "student" && student.status === "active";
  }

  app.get("/api/records/attendance", requireAuth(), async (req, res) => {
    const context = await recordContext((req as any).auth.user);
    res.json(context.attendance);
  });

  app.post("/api/records/attendance", requireAuth(["admin"]), async (req, res) => {
    try {
      const authUser = (req as any).auth.user;
      const studentId = z.coerce.number().int().positive().parse(req.body.studentId);
      if (!(await canManageStudent(authUser, studentId))) return res.status(403).json({ message: "You cannot record attendance for this student" });
      const record = await storage.createAttendance({
        studentId,
        instructorId: authUser.id,
        course: z.string().min(2).max(120).parse(req.body.course),
        sessionDate: z.coerce.date().parse(req.body.sessionDate),
        status: z.enum(["present", "late", "absent", "excused"]).parse(req.body.status),
        notes: typeof req.body.notes === "string" && req.body.notes.trim() ? req.body.notes.trim().slice(0, 500) : null,
      });
      res.status(201).json(record);
    } catch (error: any) {
      res.status(400).json({ message: "Unable to save attendance" });
    }
  });

  app.get("/api/records/grades", requireAuth(), async (req, res) => {
    const context = await recordContext((req as any).auth.user);
    res.json(context.grades);
  });

  app.post("/api/records/grades", requireAuth(["admin"]), async (req, res) => {
    try {
      const authUser = (req as any).auth.user;
      const studentId = z.coerce.number().int().positive().parse(req.body.studentId);
      if (!(await canManageStudent(authUser, studentId))) return res.status(403).json({ message: "You cannot record grades for this student" });
      const maxScore = z.coerce.number().int().positive().max(1000).parse(req.body.maxScore);
      const score = z.coerce.number().int().min(0).max(maxScore).parse(req.body.score);
      const record = await storage.createGrade({
        studentId,
        instructorId: authUser.id,
        course: z.string().min(2).max(120).parse(req.body.course),
        assignment: z.string().min(2).max(160).parse(req.body.assignment),
        score,
        maxScore,
        feedback: typeof req.body.feedback === "string" && req.body.feedback.trim() ? req.body.feedback.trim().slice(0, 1000) : null,
      });
      res.status(201).json(record);
    } catch (error: any) {
      res.status(400).json({ message: "Unable to save grade" });
    }
  });

  app.get("/api/messages", requireAuth(), async (req, res) => {
    const context = await recordContext((req as any).auth.user);
    res.json(context.messages);
  });

  app.post("/api/messages", requireAuth(), async (req, res) => {
    try {
      const authUser = (req as any).auth.user;
      const recipientId = z.coerce.number().int().positive().parse(req.body.recipientId);
      const recipient = await storage.getUser(recipientId);
      if (!recipient || recipient.status !== "active" || recipient.id === authUser.id) {
        return res.status(400).json({ message: "Choose an active recipient" });
      }
      if (authUser.role === "admin" ? recipient.role !== "student" : recipient.role !== "admin") {
        return res.status(403).json({ message: "You cannot message this recipient" });
      }
      const message = await storage.createMessage({
        senderId: authUser.id,
        recipientId,
        subject: z.string().trim().min(2).max(160).parse(req.body.subject),
        body: z.string().trim().min(2).max(5000).parse(req.body.body),
      });
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ message: "Unable to send message" });
    }
  });

  app.patch("/api/messages/:id/read", requireAuth(), async (req, res) => {
    const message = await storage.markMessageRead(Number(req.params.id), (req as any).auth.user.id);
    if (!message) return res.status(404).json({ message: "Message not found" });
    res.json(message);
  });

  function recordStats(
    records: Awaited<ReturnType<typeof recordContext>>,
    userId: number,
    activeStudents?: number,
    pendingApplications?: number,
  ) {
    const attended = records.attendance.filter(record => record.status === "present" || record.status === "late").length;
    const attendanceRate = records.attendance.length
      ? Math.round((attended / records.attendance.length) * 100)
      : 0;
    const gradePoints = records.grades.reduce((total, record) => total + (record.score / record.maxScore) * 100, 0);
    const gradeAverage = records.grades.length ? Math.round(gradePoints / records.grades.length) : 0;
    if (activeStudents !== undefined) {
      return [
        { label: "Active students", value: String(activeStudents), tone: "green" },
        { label: "Attendance rate", value: `${attendanceRate}%`, tone: "blue" },
        { label: "Grade records", value: String(records.grades.length), tone: "amber" },
        { label: "Pending requests", value: String(pendingApplications ?? 0), tone: "purple" },
      ];
    }
    return [
      { label: "Average grade", value: `${gradeAverage}%`, tone: "green" },
      { label: "Attendance", value: `${attendanceRate}%`, tone: "blue" },
      { label: "Recorded sessions", value: String(records.attendance.length), tone: "amber" },
      { label: "Unread messages", value: String(records.messages.filter(message => message.recipientId === userId && !message.readAt).length), tone: "purple" },
    ];
  }

  app.get("/api/dashboard/:role", requireAuth(["student", "admin"]), async (req, res) => {
    const authUser = (req as any).auth.user;
    const role = String(req.params.role);
    if (authUser.role !== role) return res.status(403).json({ message: "Dashboard role mismatch" });
    const records = await recordContext(authUser);
    if (role !== "student" && role !== "admin") {
      return res.status(404).json({ message: "Dashboard not found" });
    }
    if (role === "admin") {
      const users = await storage.listUsers();
      const applications = await storage.listApplications();
      const validUsers = users.filter(user => user.role === "student" || user.role === "admin");
      const studentApplications = applications.filter(application => application.requestedRole === "student");
      return res.json({
        user: authUser,
        stats: recordStats(records, authUser.id, validUsers.filter(user => user.role === "student" && user.status === "active").length, studentApplications.filter(a => a.status === "new").length),
        users: validUsers.map(toAuthUser),
        applications: studentApplications,
        ...records,
      });
    }
    const studentEnrollments = await storage.listEnrollments(authUser.id);
        const [studentLessons, materials, studentProgress, studentNotifications] = await Promise.all([
      storage.listLessons(authUser.id), Promise.resolve([]), Promise.resolve([]), storage.listNotifications(authUser.id),
    ]);
    const safeAppointments = (await storage.listAppointments(authUser.id)).map(({ notes, zoomReference, googleCalendarEventReference, ...safe }) => safe);
    res.json({ user: authUser, stats: recordStats(records, authUser.id), ...records, lessons: studentLessons.map(safeLesson), enrollments: studentEnrollments, assignedMaterials: materials, progress: studentProgress, notifications: studentNotifications, appointments: safeAppointments });
  });

  app.patch("/api/admin/users/:id/status", requireAuth(["admin"]), async (req, res) => {
    const status = z.enum(["active", "suspended"]).parse(req.body.status);
    const userId = z.coerce.number().int().positive().parse(req.params.id);
    const existing = await storage.getUser(userId);
    if (!existing || (existing.role !== "student" && existing.role !== "admin")) {
      return res.status(404).json({ message: "User not found" });
    }
    if (userId === (req as any).auth.user.id) {
      return res.status(400).json({ message: "You cannot change your own account status" });
    }
    const user = await storage.updateUser(userId, { status });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (status === "suspended") { await storage.revokeAllSessions(userId); await storage.invalidateInvitations(userId); await storage.invalidateVerificationTokens(userId); }
    res.json({ user: toAuthUser(user) });
  });

  app.patch("/api/admin/applications/:id", requireAuth(["admin"]), async (req, res) => {
    const status = z.enum(["new", "contacted", "assessment_booked", "assessed", "accepted", "rejected", "archived"]).parse(req.body.status);
    const applicationId = z.coerce.number().int().positive().parse(req.params.id);
    const existing = (await db.select().from(platformApplications).where(eq(platformApplications.id,applicationId)).limit(1))[0];
    if (!existing || existing.requestedRole !== "student") {
      return res.status(404).json({ message: "Application not found" });
    }
    if (req.body.action === "schedule") {
      let appointment;
      if (req.body.startsAt && req.body.endsAt) {
        const startsAt = z.coerce.date().parse(req.body.startsAt); const endsAt = z.coerce.date().parse(req.body.endsAt);
        if (endsAt <= startsAt || endsAt.getTime()-startsAt.getTime()>86400000 || (req.body.originalTimezone && !validTimezone(String(req.body.originalTimezone)))) return res.status(400).json({ message: "Invalid appointment time or IANA timezone" });
        appointment = await withLock(async()=>{
          await checkScheduleConflict(startsAt,endsAt,'appointment');
          const row=await storage.createAppointment({ applicationId, appointmentType: String(req.body.appointmentType || "assessment"), startsAt, endsAt, originalTimezone: req.body.originalTimezone, status: "confirmed", notes: req.body.notes });
          await queue('appointment',row.id);
          return row;
        });
      }
      if (!appointment) return res.status(400).json({ message: "Assessment start and end are required" });
      return res.json({ application: await storage.updateApplication(applicationId, "assessment_booked"), appointment });
    }
    if (req.body.action === "invite") {
      if (status !== "accepted" || existing.status !== "accepted") return res.status(409).json({ message: "Only accepted applications can be invited" });
      let user = await storage.getUserByEmail(existing.email);
      if (!user) user = await storage.createUser({ name: existing.name, email: existing.email, passwordHash: "", role: "student", status: "invited" });
      if (user.role !== "student" || user.status !== "invited") return res.status(409).json({ message: "Account is not eligible for invitation" });
      await storage.upsertProfile(user.id, { fullName: existing.name, phone: existing.phone, country: existing.country, timezone: existing.timezone, preferredLanguage: existing.preferredLanguage, ageGroup: existing.ageGroup, currentLevel: existing.currentExperience, learningGoals: existing.learningGoals, availability: existing.availability, selectedProgram: existing.requestedProgram });
      await storage.invalidateInvitations(user.id);
      const token = oneTimeToken(); await storage.createInvitation({ userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }); const emailDelivery = await sendAuthLink(user.email, "Your Salsabela Academy invitation", `${appUrl(req)}${["ar", "Arabic"].includes(existing.preferredLanguage || "") ? "/ar" : ""}/accept-invitation`, token);
      if (!emailDelivery) return res.status(202).json({ message: "Invitation created; email delivery is not configured", emailDelivery: false, application: await storage.updateApplication(applicationId, status) });
    }
    const application = await storage.updateApplication(applicationId, status);
    if (!application) return res.status(404).json({ message: "Application not found" });
    res.json({ application });
  });

  app.get("/api/profile", requireAuth(["student"]), async (req, res) => {
    const profile = await storage.getProfile((req as any).auth.user.id);
    if (!profile) return res.json({ profile: null });
    const { internalAdminNotes: _private, ...safeProfile } = profile;
    res.json({ profile: safeProfile });
  });
  app.patch("/api/profile", requireAuth(["student"]), async (req, res) => {
    const allowed = z.object({ fullName: z.string().min(2).max(200).optional(), phone: z.string().max(30).optional(), country: z.string().max(100).optional(), timezone: z.string().max(80).refine(validTimezone).optional(), preferredLanguage: z.enum(["en", "ar", "English", "Arabic"]).optional(), ageGroup: z.enum(["child", "teenager", "adult"]).optional(), currentLevel: z.string().max(200).optional(), learningGoals: z.string().max(5000).optional(), availability: z.string().max(5000).optional() }).parse(req.body);
    if (allowed.timezone && !validTimezone(allowed.timezone)) return res.status(400).json({ message: "Invalid IANA timezone" });
    res.json({ profile: safeProfile(await storage.upsertProfile((req as any).auth.user.id, allowed)) });
  });
  app.get("/api/admin/appointments", requireAuth(["admin"]), async (_req, res) => res.json(await storage.listAppointments()));
  app.post("/api/admin/appointments", requireAuth(["admin"]), async (req, res) => {
    const payload = z.object({ studentId: z.coerce.number().positive(), appointmentType: z.string().min(1), startsAt: z.coerce.date(), endsAt: z.coerce.date(), originalTimezone: z.string().optional(), notes: z.string().optional() }).parse(req.body);
    const student = await storage.getUser(payload.studentId);
    if (!student || student.role !== "student" || student.status !== "active") return res.status(400).json({ message: "Appointment requires an active student" });
    if (payload.originalTimezone && !validTimezone(payload.originalTimezone)) return res.status(400).json({ message: "Invalid IANA timezone" });
    if (payload.endsAt <= payload.startsAt) return res.status(400).json({ message: "Appointment must end after it starts" });
    res.status(201).json(await storage.createAppointment(payload));
  });
  app.post("/api/admin/enrollments", requireAuth(["admin"]), async (req, res) => {
    const payload = z.object({ studentId: z.coerce.number().positive(), programId: z.coerce.number().positive() }).parse(req.body);
    const student = await storage.getUser(payload.studentId);
    const [program] = await db.select().from(programs).where(eq(programs.id, payload.programId));
    if (!student || student.role !== "student" || student.status !== "active") return res.status(400).json({ message: "Student must have an active account" });
    if (!program || !program.isPublic) return res.status(400).json({ message: "Program is not approved" });
    const [enrollment] = await db.insert(enrollments).values(payload).onConflictDoNothing().returning();
    await storage.upsertProfile(student.id, { selectedProgram: program.name });
    res.status(enrollment ? 201 : 200).json({ enrollment: enrollment || (await storage.listEnrollments(student.id)).find(e => e.programId === payload.programId), program });
  });
  app.get("/api/admin/curriculum", requireAuth(["admin"]), async (_req, res) => {
    const catalog = await db.select().from(programs); const modules = await db.select().from(curriculumModules); const units = await db.select().from(curriculumUnits); const materialRows = await db.select().from(materials);
    res.json({ programs: catalog, modules, units, materials: materialRows });
  });
  app.post("/api/admin/materials/assign", requireAuth(["admin"]), async (req, res) => {
    const payload = z.object({ enrollmentId: z.coerce.number().positive(), materialId: z.coerce.number().positive() }).parse(req.body);
    const [valid] = await db.select({ enrollment: enrollments, material: materials, unit: curriculumUnits, module: curriculumModules }).from(enrollments).innerJoin(materials, eq(materials.id, payload.materialId)).innerJoin(curriculumUnits, eq(curriculumUnits.id, materials.unitId)).innerJoin(curriculumModules, eq(curriculumModules.id, curriculumUnits.moduleId)).where(eq(enrollments.id, payload.enrollmentId));
    if (!valid || valid.enrollment.status !== "active" || valid.enrollment.programId !== valid.module.programId) return res.status(400).json({ message: "Material does not belong to active enrollment program" });
    const [row] = await db.insert(assignedMaterials).values(payload).onConflictDoNothing().returning(); res.status(201).json(row || { ok: true });
  });
  app.patch("/api/admin/progress/:id", requireAuth(["admin"]), async (req, res) => {
    const status = z.enum(["not_started", "in_progress", "completed"]).parse(req.body.completionStatus);
    const [existingProgress] = await db.select({ progress, enrollment: enrollments, unit: curriculumUnits, module: curriculumModules }).from(progress).innerJoin(enrollments, eq(enrollments.id, progress.enrollmentId)).innerJoin(curriculumUnits, eq(curriculumUnits.id, progress.unitId)).innerJoin(curriculumModules, eq(curriculumModules.id, curriculumUnits.moduleId)).where(eq(progress.id, Number(req.params.id)));
    if (!existingProgress || existingProgress.enrollment.programId !== existingProgress.module.programId) return res.status(400).json({ message: "Progress unit does not belong to enrollment program" });
    const [row] = await db.update(progress).set({ completionStatus: status, completedAt: status === "completed" ? new Date() : null, updatedAt: new Date() }).where(eq(progress.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ message: "Progress record not found" }); res.json(row);
  });
  app.get("/api/lessons", requireAuth(["student", "admin"]), async (req, res) => {
    const user = (req as any).auth.user;
    const rows = await storage.listLessons(user.role === "student" ? user.id : undefined);
    res.json(user.role === "student" ? rows.map(safeLesson) : rows);
  });
  app.get("/api/enrollments", requireAuth(["student", "admin"]), async (req, res) => {
    const user = (req as any).auth.user; const rows = await storage.listEnrollments(user.role === "student" ? user.id : undefined);
    if (user.role === "student") return res.json(rows);
    res.json(rows);
  });
  app.get("/api/materials", requireAuth(["student"]), async (req, res) => {
    const rows = await storage.listEnrollments((req as any).auth.user.id);
    const details = await storage.listAssignedMaterialDetails(rows.filter(row => row.status === "active").map(row => row.id));
    // Legacy Drive links are not evidence of Google sharing authorization.
    // Drive resources must be opened through the checked integration endpoint.
    const safeFile = (value: string | null) => {try { const u=new URL(value||"");return u.protocol==="https:"&&!u.username&&!u.password&&!["drive.google.com","docs.google.com"].includes(u.hostname)?u.href:null;}catch{return null;}};
    res.json(details.map(row => ({ ...row, material: { ...row.material, googleDriveUrl: null, fileUrl:safeFile(row.material.fileUrl) } })));

  });
  app.get("/api/progress", requireAuth(["student"]), async (req, res) => {
    const rows = await storage.listEnrollments((req as any).auth.user.id); res.json(await storage.listProgress(rows.filter(row => row.status === "active").map(row => row.id)));
  });
  app.get("/api/notifications", requireAuth(["student", "admin"]), async (req, res) => res.json(await storage.listNotifications((req as any).auth.user.id)));
  app.patch("/api/notifications/:id/read", requireAuth(["student", "admin"]), async (req, res) => {
    const row = await storage.markNotificationRead(Number(req.params.id), (req as any).auth.user.id);
    if (!row) return res.status(404).json({ message: "Notification not found" }); res.json(row);
  });

  // ── Blog Posts — Public ──────────────────────────────────────────────────
  app.get("/api/posts", async (req, res) => {
    const { lang, all } = req.query;
    if (all) {
      const session = await getUserFromRequest(req);
      if (session?.user.role !== "admin") {
        return res.status(401).json({ message: "Unauthorized" });
      }
    }
    const opts: { language?: string; status?: string } = {};
    if (lang) opts.language = lang as string;
    if (!all) opts.status = "published";
    const limit = req.query.limit === undefined ? undefined : z.coerce.number().int().min(1).max(100).safeParse(req.query.limit);
    if (limit && !limit.success) return res.status(400).json({message:"Invalid limit"});
    const query = db.select({id:posts.id,title:posts.title,slug:posts.slug,language:posts.language,status:posts.status,coverImage:posts.coverImage,metaDescription:posts.metaDescription,createdAt:posts.createdAt,updatedAt:posts.updatedAt}).from(posts).where(and(...(opts.language?[eq(posts.language,opts.language)]:[]),...(opts.status?[eq(posts.status,opts.status)]:[]))).orderBy(desc(posts.createdAt));
    const list = await (limit?.success ? query.limit(limit.data) : query);
    res.json(list);
  });

  app.get("/api/posts/id/:id", requireAuth(["admin"]), async (req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    if (!id.success) return res.status(404).json({ message: "Post not found" });
    const post = await storage.getPost(id.data);
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  });

  app.get("/api/posts/:slug", async (req, res) => {
    const post = await storage.getPostBySlug(req.params.slug);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (req.query.lang && req.query.lang !== post.language) return res.status(404).json({message:"Post not found"});
    if (post.status !== "published") {
      const session = await getUserFromRequest(req);
      if (session?.user.role !== "admin") {
        return res.status(404).json({ message: "Post not found" });
      }
    }
    res.json(post);
  });

  // ── Blog Posts — Admin (protected) ───────────────────────────────────────
  app.post("/api/posts", requireAuth(["admin"]), async (req, res) => {
    try {
      const input = insertPostSchema.parse({ ...req.body, content: sanitizeHtml(String(req.body.content || ""), {allowedTags:["p","br","hr","strong","b","em","i","u","s","ul","ol","li","blockquote","pre","code","a","h1","h2","h3","h4","h5","h6","img","span"],allowedAttributes:{a:["href","target","rel"],img:["src","alt","title","width","height"],"*":["dir","style"]},allowedStyles:{"*":{"text-align":[/^(left|right|center|justify)$/]}},allowedSchemes:["http","https","mailto"],allowedSchemesByTag:{img:["https"]},allowProtocolRelative:false}) });
      const post = await storage.createPost(input);
      res.status(201).json(post);
    } catch (err: any) {
      res.status(400).json({ message: "Unable to create article. Check the fields and unique slug." });
    }
  });

  app.put("/api/posts/:id", requireAuth(["admin"]), async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(req.params.id);
      if (!id.success || !(await storage.getPost(id.data))) {
        return res.status(404).json({ message: "Post not found" });
      }
      const input = insertPostSchema.partial().parse({ ...req.body, ...(req.body.content !== undefined ? { content: sanitizeHtml(String(req.body.content), {allowedTags:["p","br","hr","strong","b","em","i","u","s","ul","ol","li","blockquote","pre","code","a","h1","h2","h3","h4","h5","h6","img","span"],allowedAttributes:{a:["href","target","rel"],img:["src","alt","title","width","height"],"*":["dir","style"]},allowedStyles:{"*":{"text-align":[/^(left|right|center|justify)$/]}},allowedSchemes:["http","https","mailto"],allowedSchemesByTag:{img:["https"]},allowProtocolRelative:false}) } : {}) });
      const post = await storage.updatePost(id.data, input);
      if (!post) return res.status(404).json({ message: "Post not found" });
      res.json(post);
    } catch (err: any) {
      res.status(400).json({ message: "Unable to update article. Check the fields and unique slug." });
    }
  });

  app.delete("/api/posts/:id", requireAuth(["admin"]), async (req, res) => {
    try {
      const id = z.coerce.number().int().positive().safeParse(req.params.id);
      if (!id.success || !(await storage.getPost(id.data))) {
        return res.status(404).json({ message: "Post not found" });
      }
      await storage.deletePost(id.data);
      res.status(204).end();
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to delete post" });
    }
  });

  // ────────────────────────────────────────────────────────────────────────
  // Unknown API endpoints must not fall through to the SPA's HTML response.
  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "API endpoint not found" });
  });

  return httpServer;
}
