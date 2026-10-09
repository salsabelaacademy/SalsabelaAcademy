import type { Express } from "express";
import { requireAuth } from "./auth";
import { pool } from "./db";
import { emailReady } from "./email-delivery";
import { serviceError } from "./service-errors";
import { serviceApiRevision, serviceApiVersion } from "../shared/service-contract";
const startedAt = new Date(Date.now() - process.uptime() * 1000).toISOString();
const requiredColumns: Record<string, string[]> = {
  messages: ["id", "sender_id", "recipient_id", "subject", "body", "read_at", "request_key", "created_at"],
  notifications: ["id", "user_id", "title", "body", "context"],
  ai_request_usage: ["key", "count", "expires_at"],
  account_preferences: ["user_id", "email_updates"],
  email_deliveries: ["id", "notification_id", "status", "attempts", "next_attempt", "last_error", "payload"],
  lesson_report_claims: ["lesson_id"],
};
export function registerServiceDiagnostics(app: Express) {
  app.get(
    "/api/admin/service-diagnostics",
    requireAuth(["admin"]),
    async (_req, res, next) => {
      try {
        const tables = (
          await pool.query(
            "SELECT name,to_regclass('public.'||name) IS NOT NULL AS present FROM unnest($1::text[]) AS name",
            [
              Object.keys(requiredColumns),
            ],
          )
        ).rows;
        const columns = (
          await pool.query(
            "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])",
            [Object.keys(requiredColumns)],
          )
        ).rows;
        const missingTables = tables
          .filter((r) => !r.present)
          .map((r) => r.name);
        const missingColumns = Object.entries(requiredColumns).flatMap(([table, names]) =>
          names.filter(name => !columns.some(r => r.table_name === table && r.column_name === name)).map(name => table + "." + name),
        );
        const triggers = (await pool.query("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'D' AND tgname IN ('academy_message_notification','academy_email_notification')")).rows;
        const missingTriggers = ["academy_message_notification", "academy_email_notification"].filter(name => !triggers.some(r => r.tgname === name));
        res
          .set("Cache-Control", "no-store")
          .json({
            apiRevision: serviceApiRevision,
            apiVersion: serviceApiVersion,
            startedAt,
            schemaReady: missingTables.length === 0 && missingColumns.length === 0 && missingTriggers.length === 0,
            missingTables,
            missingColumns,
            missingTriggers,
            missingMessageColumns: missingColumns.filter(c => c.startsWith("messages.")).map(c => c.slice(9)),
            geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
            emailConfigured: emailReady(),
            missingSettings: [
              "GEMINI_API_KEY",
              "RESEND_API_KEY",
              "RESEND_FROM",
              "FRONTEND_URL",
            ].filter((name) => !process.env[name]?.trim()),
            providersTested: false,
          });
      } catch (error) {
        if (!serviceError(error, res)) next(error);
      }
    },
  );
}
