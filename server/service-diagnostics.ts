import type { Express } from "express";
import { requireAuth } from "./auth";
import { pool } from "./db";
import { emailReady } from "./email-delivery";
import { serviceError } from "./service-errors";
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
              [
                "ai_request_usage",
                "account_preferences",
                "email_deliveries",
                "lesson_report_claims",
              ],
            ],
          )
        ).rows;
        const columns = (
          await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name IN ('read_at','request_key')",
          )
        ).rows;
        const missingTables = tables
          .filter((r) => !r.present)
          .map((r) => r.name);
        res
          .set("Cache-Control", "no-store")
          .json({
            apiRevision: "academy-services-2026-10-09",
            schemaReady: missingTables.length === 0 && columns.length === 2,
            missingTables,
            missingMessageColumns: ["read_at", "request_key"].filter(
              (c) => !columns.some((r) => r.column_name === c),
            ),
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
