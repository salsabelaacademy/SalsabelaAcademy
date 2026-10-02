import { db } from "./db";
import {
  courses, inquiries, posts,
  users, authSessions, passwordResetTokens, platformApplications,
  attendanceRecords, gradeRecords, messages,
  studentProfiles, appointments, lessons, enrollments, assignedMaterials, progress, notifications, materials, curriculumUnits, curriculumModules, programs,
  invitations, verificationTokens,
  type Course, type InsertCourse,
  type Inquiry, type InsertInquiry,
  type Post, type InsertPost,
  type AttendanceRecord, type GradeRecord, type Message,
} from "@shared/schema";
import { eq, and, desc, isNull, inArray, or, sql } from "drizzle-orm";

export interface IStorage {
  getCourses(): Promise<Course[]>;
  getCourse(id: number): Promise<Course | undefined>;
  createCourse(course: InsertCourse): Promise<Course>;
  createInquiry(inquiry: InsertInquiry): Promise<Inquiry>;

  getPosts(opts?: { language?: string; status?: string }): Promise<Post[]>;
  getPostBySlug(slug: string): Promise<Post | undefined>;
  getPost(id: number): Promise<Post | undefined>;
  createPost(post: InsertPost): Promise<Post>;
  updatePost(id: number, data: Partial<InsertPost>): Promise<Post | undefined>;
  deletePost(id: number): Promise<void>;
  getUserByEmail(email: string): Promise<typeof users.$inferSelect | undefined>;
  getUser(id: number): Promise<typeof users.$inferSelect | undefined>;
  listUsers(): Promise<typeof users.$inferSelect[]>;
  createUser(data: typeof users.$inferInsert): Promise<typeof users.$inferSelect>;
  updateUser(id: number, data: Partial<typeof users.$inferInsert>): Promise<typeof users.$inferSelect | undefined>;
  createSession(data: typeof authSessions.$inferInsert): Promise<typeof authSessions.$inferSelect>;
  getSession(tokenHash: string): Promise<typeof authSessions.$inferSelect | undefined>;
  revokeSession(tokenHash: string): Promise<void>;
  createResetToken(data: typeof passwordResetTokens.$inferInsert): Promise<typeof passwordResetTokens.$inferSelect>;
  getResetToken(tokenHash: string): Promise<typeof passwordResetTokens.$inferSelect | undefined>;
  markResetTokenUsed(id: number): Promise<void>;
  consumeResetToken(id: number): Promise<boolean>;
  listAttendance(opts?: { studentIds?: number[]; studentId?: number }): Promise<AttendanceRecord[]>;
  createAttendance(data: typeof attendanceRecords.$inferInsert): Promise<AttendanceRecord>;
  listGrades(opts?: { studentIds?: number[]; studentId?: number }): Promise<GradeRecord[]>;
  createGrade(data: typeof gradeRecords.$inferInsert): Promise<GradeRecord>;
  listMessages(userId: number): Promise<Message[]>;
  createMessage(data: typeof messages.$inferInsert): Promise<Message>;
  markMessageRead(id: number, recipientId: number): Promise<Message | undefined>;
  listApplications(): Promise<typeof platformApplications.$inferSelect[]>;
  createApplication(data: typeof platformApplications.$inferInsert): Promise<typeof platformApplications.$inferSelect>;
  updateApplication(id: number, status: string): Promise<typeof platformApplications.$inferSelect | undefined>;
  getProfile(userId: number): Promise<typeof studentProfiles.$inferSelect | undefined>;
  upsertProfile(userId: number, data: Partial<typeof studentProfiles.$inferInsert>): Promise<typeof studentProfiles.$inferSelect>;
  listAppointments(userId?: number): Promise<typeof appointments.$inferSelect[]>;
  createAppointment(data: typeof appointments.$inferInsert): Promise<typeof appointments.$inferSelect>;
  listLessons(studentId?: number): Promise<typeof lessons.$inferSelect[]>;
  listEnrollments(studentId?: number): Promise<typeof enrollments.$inferSelect[]>;
  listAssignedMaterials(enrollmentIds: number[]): Promise<typeof assignedMaterials.$inferSelect[]>;
  listAssignedMaterialDetails(enrollmentIds: number[]): Promise<any[]>;
  listProgress(enrollmentIds: number[]): Promise<typeof progress.$inferSelect[]>;
  listNotifications(userId: number): Promise<typeof notifications.$inferSelect[]>;
  markNotificationRead(id: number, userId: number): Promise<typeof notifications.$inferSelect | undefined>;
  createInvitation(data: typeof invitations.$inferInsert): Promise<typeof invitations.$inferSelect>;
  getInvitation(tokenHash: string): Promise<typeof invitations.$inferSelect | undefined>;
  useInvitation(id: number): Promise<void>;
  consumeInvitation(id: number): Promise<boolean>;
  invalidateInvitations(userId: number): Promise<void>;
  createVerificationToken(data: typeof verificationTokens.$inferInsert): Promise<typeof verificationTokens.$inferSelect>;
  getVerificationToken(tokenHash: string): Promise<typeof verificationTokens.$inferSelect | undefined>;
  useVerificationToken(id: number): Promise<void>;
  consumeVerificationToken(id: number): Promise<boolean>;
  invalidateVerificationTokens(userId: number): Promise<void>;
  revokeAllSessions(userId: number): Promise<void>;
  recordLoginFailure(userId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getCourses(): Promise<Course[]> {
    return await db.select().from(courses);
  }

  async getCourse(id: number): Promise<Course | undefined> {
    const [course] = await db.select().from(courses).where(eq(courses.id, id));
    return course;
  }

  async createCourse(course: InsertCourse): Promise<Course> {
    const [newCourse] = await db.insert(courses).values(course).returning();
    return newCourse;
  }

  async createInquiry(inquiry: InsertInquiry): Promise<Inquiry> {
    const [newInquiry] = await db.insert(inquiries).values(inquiry).returning();
    return newInquiry;
  }

  async getPosts(opts?: { language?: string; status?: string }): Promise<Post[]> {
    const conditions = [];
    if (opts?.language) conditions.push(eq(posts.language, opts.language));
    if (opts?.status)   conditions.push(eq(posts.status, opts.status));

    const query = db.select().from(posts).orderBy(desc(posts.createdAt));
    if (conditions.length === 0) return await query;
    if (conditions.length === 1) return await db.select().from(posts).where(conditions[0]).orderBy(desc(posts.createdAt));
    return await db.select().from(posts).where(and(...conditions)).orderBy(desc(posts.createdAt));
  }

  async getPostBySlug(slug: string): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.slug, slug));
    return post;
  }

  async getPost(id: number): Promise<Post | undefined> {
    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    return post;
  }

  async createPost(post: InsertPost): Promise<Post> {
    const [newPost] = await db.insert(posts).values(post).returning();
    return newPost;
  }

  async updatePost(id: number, data: Partial<InsertPost>): Promise<Post | undefined> {
    const [updated] = await db
      .update(posts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    return updated;
  }

  async deletePost(id: number): Promise<void> {
    await db.delete(posts).where(eq(posts.id, id));
  }

  async getUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async getUser(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async listUsers() {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(data: typeof users.$inferInsert) {
    const [user] = await db.insert(users).values({ ...data, email: data.email.toLowerCase() }).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<typeof users.$inferInsert>) {
    const [user] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user;
  }

  async createSession(data: typeof authSessions.$inferInsert) {
    const [session] = await db.insert(authSessions).values(data).returning();
    return session;
  }

  async getSession(tokenHash: string) {
    const [session] = await db.select().from(authSessions).where(
      and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt))
    );
    return session;
  }

  async revokeSession(tokenHash: string) {
    await db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.tokenHash, tokenHash));
  }

  async revokeAllSessions(userId: number) {
    await db.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
  }
  async recordLoginFailure(userId: number) {
    await db.update(users).set({
      failedLoginAttempts: sql`${users.failedLoginAttempts} + 1`,
      lockedUntil: sql`case when ${users.failedLoginAttempts} + 1 >= 5 then now() + interval '15 minutes' else ${users.lockedUntil} end`,
      updatedAt: new Date(),
    }).where(eq(users.id, userId));
  }

  async getProfile(userId: number) {
    const [profile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId));
    return profile;
  }
  async upsertProfile(userId: number, data: Partial<typeof studentProfiles.$inferInsert>) {
    const existing = await this.getProfile(userId);
    if (existing) {
      const [updated] = await db.update(studentProfiles).set({ ...data, updatedAt: new Date() }).where(eq(studentProfiles.userId, userId)).returning();
      return updated;
    }
    const [created] = await db.insert(studentProfiles).values({ userId, fullName: String(data.fullName || ""), ...data }).returning();
    return created;
  }
  async listAppointments(userId?: number) {
    return userId ? db.select().from(appointments).where(eq(appointments.studentId, userId)).orderBy(desc(appointments.startsAt)) : db.select().from(appointments).orderBy(desc(appointments.startsAt));
  }
  async createAppointment(data: typeof appointments.$inferInsert) { const [row] = await db.insert(appointments).values(data).returning(); return row; }
  async listLessons(studentId?: number) {
    return studentId ? db.select().from(lessons).where(eq(lessons.studentId, studentId)).orderBy(desc(lessons.startsAt)) : db.select().from(lessons).orderBy(desc(lessons.startsAt));
  }
  async listEnrollments(studentId?: number) {
    return studentId ? db.select().from(enrollments).where(eq(enrollments.studentId, studentId)) : db.select().from(enrollments);
  }
  async listAssignedMaterials(enrollmentIds: number[]) { return enrollmentIds.length ? db.select().from(assignedMaterials).where(inArray(assignedMaterials.enrollmentId, enrollmentIds)) : []; }
  async listAssignedMaterialDetails(enrollmentIds: number[]) {
    if (!enrollmentIds.length) return [];
    return db.select({ assignment: assignedMaterials, material: materials, unit: curriculumUnits, module: curriculumModules, program: programs })
      .from(assignedMaterials).innerJoin(materials, eq(materials.id, assignedMaterials.materialId))
      .innerJoin(curriculumUnits, eq(curriculumUnits.id, materials.unitId))
      .innerJoin(curriculumModules, eq(curriculumModules.id, curriculumUnits.moduleId))
      .innerJoin(programs, eq(programs.id, curriculumModules.programId))
      .innerJoin(enrollments, eq(enrollments.id, assignedMaterials.enrollmentId))
      .where(and(inArray(assignedMaterials.enrollmentId, enrollmentIds),eq(enrollments.programId,curriculumModules.programId),eq(enrollments.status,"active")));
  }
  async listProgress(enrollmentIds: number[]) { return enrollmentIds.length ? db.select().from(progress).where(inArray(progress.enrollmentId, enrollmentIds)) : []; }
  async listNotifications(userId: number) { return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)); }
  async markNotificationRead(id: number, userId: number) {
    const [row] = await db.update(notifications).set({ readAt: new Date(), updatedAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning(); return row;
  }
  async createInvitation(data: typeof invitations.$inferInsert) { const [row] = await db.insert(invitations).values(data).returning(); return row; }
  async getInvitation(tokenHash: string) { const [row] = await db.select().from(invitations).where(and(eq(invitations.tokenHash, tokenHash), isNull(invitations.acceptedAt))); return row; }
  async useInvitation(id: number) { await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, id)); }
  async consumeInvitation(id: number) { const rows = await db.update(invitations).set({ acceptedAt: new Date() }).where(and(eq(invitations.id, id), isNull(invitations.acceptedAt))).returning(); return rows.length === 1; }
  async invalidateInvitations(userId: number) { await db.update(invitations).set({ acceptedAt: new Date() }).where(and(eq(invitations.userId, userId), isNull(invitations.acceptedAt))); }
  async createVerificationToken(data: typeof verificationTokens.$inferInsert) { const [row] = await db.insert(verificationTokens).values(data).returning(); return row; }
  async getVerificationToken(tokenHash: string) { const [row] = await db.select().from(verificationTokens).where(and(eq(verificationTokens.tokenHash, tokenHash), isNull(verificationTokens.usedAt))); return row; }
  async useVerificationToken(id: number) { await db.update(verificationTokens).set({ usedAt: new Date() }).where(eq(verificationTokens.id, id)); }
  async consumeVerificationToken(id: number) { const rows = await db.update(verificationTokens).set({ usedAt: new Date() }).where(and(eq(verificationTokens.id, id), isNull(verificationTokens.usedAt))).returning(); return rows.length === 1; }
  async invalidateVerificationTokens(userId: number) { await db.update(verificationTokens).set({ usedAt: new Date() }).where(and(eq(verificationTokens.userId, userId), isNull(verificationTokens.usedAt))); }

  async createResetToken(data: typeof passwordResetTokens.$inferInsert) {
    const [token] = await db.insert(passwordResetTokens).values(data).returning();
    return token;
  }

  async getResetToken(tokenHash: string) {
    const [token] = await db.select().from(passwordResetTokens).where(
      and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt))
    );
    return token;
  }

  async markResetTokenUsed(id: number) {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  }
  async consumeResetToken(id: number) {
    const rows = await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(eq(passwordResetTokens.id, id), isNull(passwordResetTokens.usedAt))).returning(); return rows.length === 1;
  }

  async listAttendance(opts?: { studentIds?: number[]; studentId?: number }) {
    if (opts?.studentIds && opts.studentIds.length === 0) return [];
    const conditions = [];
    if (opts?.studentId) conditions.push(eq(attendanceRecords.studentId, opts.studentId));
    if (opts?.studentIds?.length) conditions.push(inArray(attendanceRecords.studentId, opts.studentIds));
    const query = db.select().from(attendanceRecords).orderBy(desc(attendanceRecords.sessionDate));
    if (conditions.length === 0) return await query;
    return await db.select().from(attendanceRecords).where(and(...conditions)).orderBy(desc(attendanceRecords.sessionDate));
  }

  async createAttendance(data: typeof attendanceRecords.$inferInsert) {
    const [record] = await db.insert(attendanceRecords).values(data).returning();
    return record;
  }

  async listGrades(opts?: { studentIds?: number[]; studentId?: number }) {
    if (opts?.studentIds && opts.studentIds.length === 0) return [];
    const conditions = [];
    if (opts?.studentId) conditions.push(eq(gradeRecords.studentId, opts.studentId));
    if (opts?.studentIds?.length) conditions.push(inArray(gradeRecords.studentId, opts.studentIds));
    const query = db.select().from(gradeRecords).orderBy(desc(gradeRecords.gradedAt));
    if (conditions.length === 0) return await query;
    return await db.select().from(gradeRecords).where(and(...conditions)).orderBy(desc(gradeRecords.gradedAt));
  }

  async createGrade(data: typeof gradeRecords.$inferInsert) {
    const [record] = await db.insert(gradeRecords).values(data).returning();
    return record;
  }

  async listMessages(userId: number) {
    return await db.select().from(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId)))
      .orderBy(desc(messages.createdAt));
  }

  async createMessage(data: typeof messages.$inferInsert) {
    const [message] = await db.insert(messages).values(data).returning();
    // The database message trigger creates one durable notification.
    return message;
  }

  async markMessageRead(id: number, recipientId: number) {
    const [message] = await db.update(messages)
      .set({ readAt: new Date() })
      .where(and(eq(messages.id, id), eq(messages.recipientId, recipientId)))
      .returning();
    return message;
  }

  async listApplications() {
    return await db.select().from(platformApplications).orderBy(desc(platformApplications.createdAt));
  }

  async createApplication(data: typeof platformApplications.$inferInsert) {
    const [application] = await db.insert(platformApplications).values({
      ...data,
      email: data.email.toLowerCase(),
    }).returning();
    return application;
  }

  async updateApplication(id: number, status: string) {
    const [application] = await db.update(platformApplications).set({ status: status as "new" | "contacted" | "assessment_booked" | "assessed" | "accepted" | "rejected" | "archived" }).where(eq(platformApplications.id, id)).returning();
    return application;
  }
}

export const storage = new DatabaseStorage();
