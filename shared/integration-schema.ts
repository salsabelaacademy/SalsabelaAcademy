import { pgTable, text, integer, timestamp, serial, boolean, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users, enrollments, materials } from "./schema";

// Kept separate to avoid accidental serialization through academy DTOs.
export const integrationConnections = pgTable("integration_connections", {
  provider: text("provider").primaryKey(), enabled: boolean("enabled").notNull().default(false),
  secret: text("secret"), lastSuccess: timestamp("last_success", { withTimezone: true }), error: text("error"),
}, t => [check("integration_provider_check", sql`${t.provider} in ('zoom','calendar','classroom','drive')`)]);
export const integrationOauthStates = pgTable("integration_oauth_states", {
  hash: text("hash").primaryKey(), userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), sessionHash: text("session_hash").notNull(),
  provider: text("provider").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const integrationJobs = pgTable("integration_jobs", {
  id: serial("id").primaryKey(), key: text("key").notNull().unique(), kind: text("kind").notNull(), resourceId: integer("resource_id").notNull(),
  state: text("state").notNull().default("pending"), attempts: integer("attempts").notNull().default(0), error: text("error"),
  generation: integer("generation").notNull().default(1),
  nextAt: timestamp("next_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("integration_jobs_due_idx").on(t.state, t.nextAt), check("integration_job_kind_check", sql`${t.kind} in ('lesson','appointment','classroom')`), check("integration_job_state_check", sql`${t.state} in ('pending','running','succeeded','failed')`)]);
export const integrationMeetings = pgTable("integration_meetings", {
  key: text("key").primaryKey(), zoomId: text("zoom_id"), joinUrl: text("join_url"),
  createState: text("create_state").notNull().default("new"), calendarId: text("calendar_id"),
  calendarContainer: text("calendar_container"), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  timezone: text("timezone"),
});
export const integrationClassroomLinks = pgTable("integration_classroom_links", {
  enrollmentId: integer("enrollment_id").primaryKey().references(() => enrollments.id, { onDelete: "cascade" }), courseId: text("course_id").notNull(),
  state: text("state").notNull().default("pending"), invitationId: text("invitation_id"), error: text("error"),
});
export const integrationDriveResources = pgTable("integration_drive_resources", {
  materialId: integer("material_id").primaryKey().references(() => materials.id, { onDelete: "cascade" }), fileId: text("file_id").notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});
