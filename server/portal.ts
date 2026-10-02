import { registerDashboardSearch } from "./dashboard-search";
import { registerPushRoutes } from "./push";
import { registerTestimonials } from "./testimonials";
import { registerAvatars } from "./avatars";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import { pool } from "./db";
import { requireAuth, tokenHash } from "./auth";
import { verifyTurnstile } from "./turnstile";
import { statuses } from "./integrations/service";
const id = z.coerce.number().int().positive();
const text = z.string().trim().min(1).max(5000);
const run: (fn: RequestHandler) => RequestHandler =
  (fn) => async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      if (e instanceof z.ZodError)
        return res
          .status(400)
          .json({
            code: "validation",
            fields: e.issues.map((i) => i.path.join(".")),
          });
      next(e);
    }
  };
const rows = async (q: string, args: any[] = []) =>
  (await pool.query(q, args)).rows;
export const publicLimit: RequestHandler = run(async (req, res, next) => {
  await pool.query(
    "DELETE FROM public_request_limits WHERE key IN (SELECT key FROM public_request_limits WHERE expires_at < now() LIMIT 100)",
  );
  const key = createHash("sha256")
    .update(`${req.ip}:${req.path}`)
    .digest("hex");
  const [row] = await rows(
    `INSERT INTO public_request_limits(key,count,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN public_request_limits.expires_at<now() THEN 1 ELSE public_request_limits.count+1 END,expires_at=CASE WHEN public_request_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE public_request_limits.expires_at END RETURNING count`,
    [key],
  );
  if (row.count > 10) {
    res.setHeader("Retry-After", "900");
    return res.status(429).json({ code: "limited" });
  }
  next();
});
export function registerPortalRoutes(app: Express) {
  registerDashboardSearch(app);
  registerAvatars(app, publicLimit);
  registerPushRoutes(app, publicLimit);
  app.get("/api/portal/account", requireAuth(["admin", "student"]), run(async (req, res) => {
    const user = (req as any).auth.user;
    const [account] = await rows("SELECT name,email,role,status,email_verified_at,created_at,last_login_at FROM users WHERE id=$1", [user.id]);
    const [profile] = user.role === "student" ? await rows("SELECT phone,country,timezone,preferred_language FROM student_profiles WHERE user_id=$1", [user.id]) : [];
    res.json({ ...account, ...profile });
  }));
  app.patch("/api/portal/account", requireAuth(["admin", "student"]), run(async (req, res) => {
    const user = (req as any).auth.user;
    const payload = z.object({
      name: z.string().trim().min(2).max(200),
      phone: z.string().trim().max(30).optional(),
      country: z.string().trim().max(100).optional(),
      timezone: z.string().max(80).refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }).optional(),
      preferredLanguage: z.enum(["ar", "en"]).optional(),
    }).strict().parse(req.body);
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("UPDATE users SET name=$1 WHERE id=$2", [payload.name, user.id]);
      if (user.role === "student") await connection.query(
        `INSERT INTO student_profiles(user_id,full_name,phone,country,timezone,preferred_language) VALUES($1,$2,$3,$4,$5,$6)
         ON CONFLICT(user_id) DO UPDATE SET full_name=EXCLUDED.full_name,phone=COALESCE($3,student_profiles.phone),country=COALESCE($4,student_profiles.country),timezone=COALESCE($5,student_profiles.timezone),preferred_language=COALESCE($6,student_profiles.preferred_language)`,
        [user.id,payload.name,payload.phone ?? null,payload.country ?? null,payload.timezone ?? null,payload.preferredLanguage ?? null],
      );
      await connection.query("COMMIT");
      res.json({ ok: true });
    } catch (error) { await connection.query("ROLLBACK"); throw error; }
    finally { connection.release(); }
  }));
  app.use("/api", (req, res, next) => {
    res.on("finish", () => {
      const auth = (req as any).auth;
      if (
        auth?.user.role === "admin" &&
        res.statusCode < 300 &&
        ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
        !req.path.includes("/auth/")
      )
        void pool
          .query(
            "INSERT INTO academy_audit(actor_id,action,resource) VALUES($1,$2,$3)",
            [auth.user.id, req.method, req.path],
          )
          .catch(() => console.error("Audit write failed"));
    });
    next();
  });
  registerTestimonials(app);
  app.use(["/api/applications", "/api/contact"], publicLimit);
  app.get(
    "/api/public-settings",
    run(async (_req, res) => {
      const [settings] = await rows(
        "SELECT public_name,contact_email FROM academy_settings WHERE id=1",
      );
      res.json(settings || {});
    }),
  );
  app.post(
    "/api/contact",
    run(async (req, res) => {
      const v = z
        .object({
          name: text.max(200),
          email: z
            .string()
            .email()
            .max(254)
            .transform((s) => s.toLowerCase()),
          subject: text.max(160),
          message: text,
        })
        .parse(req.body);
      if (!(await verifyTurnstile(req.body.turnstileToken, req.ip)).ok)
        return res.status(403).json({ code: "security" });
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(v))
        .digest("hex");
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          fingerprint,
        ]);
        const prior = await c.query(
          "SELECT id FROM contact_messages WHERE fingerprint=$1 AND created_at>now()-interval '15 minutes'",
          [fingerprint],
        );
        if (!prior.rows.length)
          await c.query(
            "INSERT INTO contact_messages(name,email,subject,message,fingerprint) VALUES($1,$2,$3,$4,$5)",
            [v.name, v.email, v.subject, v.message, fingerprint],
          );
        await c.query("COMMIT");
        res.status(prior.rows.length ? 200 : 201).json({ ok: true });
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }),
  );
  app.get(
    "/api/portal",
    requireAuth(),
    run(async (req, res) => {
      const u = (req as any).auth.user,
        admin = u.role === "admin";
      const [
        lessonRows,
        enrollmentRows,
        notificationRows,
        messageRows,
        attendanceRows,
        people,
        programRows,
        sessions,
      ] = await Promise.all([
        rows(
          `SELECT * FROM lessons ${admin ? "" : "WHERE student_id=$1"} ORDER BY starts_at DESC NULLS LAST`,
          admin ? [] : [u.id],
        ),
        rows(
          `SELECT e.*,p.name AS program,p.slug FROM enrollments e JOIN programs p ON p.id=e.program_id ${admin ? "" : "WHERE student_id=$1"}`,
          admin ? [] : [u.id],
        ),
        rows(
          "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC",
          [u.id],
        ),
        rows(
          "SELECT m.*,s.name AS sender_name,r.name AS recipient_name FROM messages m JOIN users s ON s.id=m.sender_id JOIN users r ON r.id=m.recipient_id WHERE sender_id=$1 OR recipient_id=$1 ORDER BY m.created_at DESC",
          [u.id],
        ),
        rows(
          `SELECT id,student_id,course,session_date,status,notes FROM attendance_records ${admin ? "" : "WHERE student_id=$1"} ORDER BY session_date DESC`,
          admin ? [] : [u.id],
        ),
        rows(
          `SELECT id,name,role,status${admin ? ",email" : ""} FROM users WHERE ${admin ? "role='student'" : "role='admin' AND status='active'"}`,
        ),
        rows(
          "SELECT id,name,slug FROM programs WHERE is_public=true",
        ),
        rows(
          "SELECT id,created_at,expires_at FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>now()",
          [u.id],
        ),
      ]);
      const base: any = {
        lessons: admin
          ? lessonRows
          : lessonRows.map(
              ({
                private_admin_notes,
                zoom_reference,
                google_calendar_reference,
                ...l
              }) => l,
            ),
        enrollments: enrollmentRows,
        notifications: notificationRows,
        messages: messageRows,
        attendance: attendanceRows,
        people,
        programs: programRows,
        sessions,
      };
      if (admin) {
        const [
          applications,
          appointments,
          contacts,
          audit,
          settings,
          catalog,
          units,
          modules,
          progress,
          connections,
          failed,
        ] = await Promise.all([
          rows("SELECT * FROM platform_applications ORDER BY created_at DESC"),
          rows("SELECT * FROM appointments ORDER BY starts_at"),
          rows(
            "SELECT id,name,email,subject,message,created_at FROM contact_messages ORDER BY created_at DESC",
          ),
          rows(
            "SELECT a.*,u.name FROM academy_audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 200",
          ),
          rows("SELECT * FROM academy_settings WHERE id=1"),
          rows("SELECT * FROM materials"),
          rows("SELECT * FROM curriculum_units ORDER BY sort_order,id"),
          rows("SELECT * FROM curriculum_modules ORDER BY sort_order,id"),
          rows("SELECT * FROM student_progress"),
          statuses(),
          rows(
            "SELECT count(*)::integer AS count FROM integration_jobs WHERE state IN ('failed','blocked','needs_review')",
          ),
        ]);
        Object.assign(base, {
          applications,
          appointments,
          contacts,
          audit,
          settings: settings[0],
          materials: catalog,
          units,
          modules,
          progress,
          connections,
        });
        base.stats = {
          newApplications: applications.filter((a) => a.status === "new")
            .length,
          actionApplications: applications.filter((a) =>
            ["new", "contacted", "assessment_booked", "assessed"].includes(
              a.status,
            ),
          ).length,
          activeStudents: people.filter((p) => p.status === "active").length,
          upcomingAssessments: appointments.filter(
            (a) =>
              ["requested", "confirmed"].includes(a.status) &&
              new Date(a.starts_at) > new Date(),
          ).length,
          upcomingLessons: lessonRows.filter(
            (l) =>
              l.status === "scheduled" && new Date(l.starts_at) > new Date(),
          ).length,
          failedSyncs: failed[0].count,
        };
      } else {
        const [profile, units, materials, progress] = await Promise.all([
          rows("SELECT * FROM student_profiles WHERE user_id=$1", [u.id]),
          rows(
            `SELECT u.*,p.completion_status,p.id AS progress_id FROM curriculum_units u JOIN student_progress p ON p.unit_id=u.id JOIN enrollments e ON e.id=p.enrollment_id JOIN curriculum_modules m ON m.id=u.module_id WHERE e.student_id=$1 AND e.status='active' AND m.program_id=e.program_id`,
            [u.id],
          ),
          rows(
            `SELECT m.id,m.title FROM materials m JOIN assigned_materials a ON a.material_id=m.id JOIN enrollments e ON e.id=a.enrollment_id JOIN curriculum_units u ON u.id=m.unit_id JOIN curriculum_modules cm ON cm.id=u.module_id WHERE e.student_id=$1 AND e.status='active' AND cm.program_id=e.program_id AND m.file_url ~ '^https://' AND m.file_url !~ '^https://(drive|docs)[.]google[.]com/'`,
            [u.id],
          ),
          rows(
            "SELECT p.* FROM student_progress p JOIN enrollments e ON e.id=p.enrollment_id WHERE e.student_id=$1 AND e.status='active'",
            [u.id],
          ),
        ]);
        const { internal_admin_notes, ...safe } = profile[0] || {};
        Object.assign(base, {
          profile: safe,
          units,
          materials,
          progress,
          stats: {
            upcomingLessons: lessonRows.filter(
              (l) =>
                l.status === "scheduled" && new Date(l.starts_at) > new Date(),
            ).length,
            completedUnits: progress.filter(
              (p) => p.completion_status === "completed",
            ).length,
          },
        });
      }
      Object.assign(base.stats, {
        unreadNotifications: notificationRows.filter((n) => !n.read_at).length,
        unreadMessages: messageRows.filter(
          (m) => m.recipient_id === u.id && !m.read_at,
        ).length,
        attendanceSummary: attendanceRows.length,
        attendanceRate: attendanceRows.length
          ? Math.round(
              (100 *
                attendanceRows.filter((a) =>
                  ["present", "late"].includes(a.status),
                ).length) /
                attendanceRows.length,
            )
          : null,
      });
      res.json(base);
    }),
  );
  app.get(
    "/api/portal/materials/:id/open",
    requireAuth(["student"]),
    run(async (req, res) => {
      const [m] = await rows(
        `SELECT m.file_url FROM materials m JOIN assigned_materials a ON a.material_id=m.id JOIN enrollments e ON e.id=a.enrollment_id JOIN curriculum_units u ON u.id=m.unit_id JOIN curriculum_modules cm ON cm.id=u.module_id WHERE m.id=$1 AND e.student_id=$2 AND e.status='active' AND cm.program_id=e.program_id`,
        [id.parse(req.params.id), (req as any).auth.user.id],
      );
      if (!m?.file_url) return res.status(404).json({ code: "not_found" });
      let url: URL;
      try {
        url = new URL(m.file_url);
      } catch {
        return res.status(400).json({ code: "invalid_url" });
      }
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        ["drive.google.com", "docs.google.com"].includes(url.hostname)
      )
        return res.status(403).json({ code: "forbidden" });
      res.json({ url: url.href });
    }),
  );
  app.delete(
    "/api/portal/sessions/:id",
    requireAuth(),
    run(async (req, res) => {
      const result = await rows(
        "UPDATE auth_sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 RETURNING id,token_hash",
        [id.parse(req.params.id), (req as any).auth.user.id],
      );
      res
        .status(result.length ? 200 : 404)
        .json({
          ok: !!result.length,
          current: result[0]?.token_hash === tokenHash((req as any).auth.token),
        });
    }),
  );
  app.patch(
    "/api/portal/applications/:id/notes",
    requireAuth(["admin"]),
    run(async (req, res) => {
      const found = await rows(
        "UPDATE platform_applications SET admin_notes=$2,updated_at=now() WHERE id=$1 RETURNING id",
        [id.parse(req.params.id), z.string().max(5000).parse(req.body.notes)],
      );
      res.status(found.length ? 200 : 404).json({ ok: !!found.length });
    }),
  );
  app.patch(
    "/api/portal/lessons/:id/details",
    requireAuth(["admin"]),
    run(async (req, res) => {
      const v = z
        .object({
          homework: z.string().max(5000),
          feedback: z.string().max(5000),
          privateNotes: z.string().max(5000),
          attendance: z
            .enum(["present", "absent", "late", "excused"])
            .optional(),
        })
        .parse(req.body);
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const {
          rows: [l],
        } = await c.query("SELECT * FROM lessons WHERE id=$1 FOR UPDATE", [
          id.parse(req.params.id),
        ]);
        if (!l) {
          await c.query("ROLLBACK");
          return res.status(404).json({ code: "not_found" });
        }
        await c.query(
          "UPDATE lessons SET homework=$2,feedback=$3,private_admin_notes=$4,attendance=COALESCE($5,attendance),updated_at=now() WHERE id=$1",
          [l.id, v.homework, v.feedback, v.privateNotes, v.attendance || null],
        );
        if (v.attendance) {
          await c.query(
            "DELETE FROM attendance_records WHERE student_id=$1 AND course=$2 AND session_date=$3",
            [l.student_id, `lesson:${l.id}`, l.starts_at],
          );
          await c.query(
            "INSERT INTO attendance_records(student_id,instructor_id,course,session_date,status) VALUES($1,$2,$3,$4,$5)",
            [
              l.student_id,
              (req as any).auth.user.id,
              `lesson:${l.id}`,
              l.starts_at,
              v.attendance,
            ],
          );
        }
        await c.query("COMMIT");
        res.json({ ok: true });
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }),
  );
  app.post(
    "/api/portal/modules",
    requireAuth(["admin"]),
    run(async (req, res) => {
      const v = z
        .object({ programId: id, title: text.max(200) })
        .parse(req.body);
      const result = await rows(
        "INSERT INTO curriculum_modules(program_id,title) SELECT id,$2 FROM programs WHERE id=$1 RETURNING id",
        [v.programId, v.title],
      );
      res.status(result.length ? 201 : 404).json({ ok: !!result.length });
    }),
  );
  app.post(
    "/api/portal/units",
    requireAuth(["admin"]),
    run(async (req, res) => {
      const v = z
        .object({ moduleId: id, title: text.max(200), body: text })
        .parse(req.body);
      const result = await rows(
        "INSERT INTO curriculum_units(module_id,title,body) SELECT id,$2,$3 FROM curriculum_modules WHERE id=$1 RETURNING id",
        [v.moduleId, v.title, v.body],
      );
      res.status(result.length ? 201 : 404).json({ ok: !!result.length });
    }),
  );
  app.post(
    "/api/portal/assign",
    requireAuth(["admin"]),
    run(async (req, res) => {
      const v = z.object({ enrollmentId: id, unitId: id }).parse(req.body);
      const result = await rows(
        `INSERT INTO student_progress(enrollment_id,unit_id) SELECT e.id,u.id FROM enrollments e JOIN users s ON s.id=e.student_id JOIN curriculum_units u ON u.id=$2 JOIN curriculum_modules m ON m.id=u.module_id WHERE e.id=$1 AND e.status='active' AND s.status='active' AND m.program_id=e.program_id ON CONFLICT(enrollment_id,unit_id) DO UPDATE SET updated_at=now() RETURNING id`,
        [v.enrollmentId, v.unitId],
      );
      res.status(result.length ? 201 : 400).json({ ok: !!result.length });
    }),
  );
  app.patch(
    "/api/portal/settings",
    requireAuth(["admin"]),
    run(async (req, res) => {
      const v = z
        .object({
          publicName: text.max(200),
          contactEmail: z.union([z.literal(""), z.string().email().max(254)]),
        })
        .parse(req.body);
      await rows(
        "UPDATE academy_settings SET public_name=$1,contact_email=$2,updated_at=now() WHERE id=1",
        [v.publicName, v.contactEmail],
      );
      res.json({ ok: true });
    }),
  );
}
