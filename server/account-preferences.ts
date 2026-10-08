import { serviceError } from "./service-errors";
import { emailReady } from "./email-delivery";
import type { Express } from "express";
import { z } from "zod";
import { pool } from "./db";
import { requireAuth } from "./auth";
export function registerAccountPreferences(app: Express) {
  const auth = requireAuth(["admin", "student"]);
  app.get(
    "/api/admin/email-deliveries",
    requireAuth(["admin"]),
    async (_req, res, next) => {
      try {
        const { rows } = await pool.query(
          "SELECT status,count(*)::int AS count FROM email_deliveries WHERE created_at>now()-interval '30 days' GROUP BY status",
        );
        res.json({
          configured: emailReady(),
          missing: ["RESEND_API_KEY", "RESEND_FROM", "FRONTEND_URL"].filter(
            (key) => !process.env[key]?.trim(),
          ),
          invalidOrigin: Boolean(
            process.env.FRONTEND_URL &&
              !/^https:\/\//.test(process.env.FRONTEND_URL),
          ),
          counts: Object.fromEntries(rows.map((r) => [r.status, r.count])),
        });
      } catch (e) {
        if (!serviceError(e, res)) next(e);
      }
    },
  );
  app.post(
    "/api/admin/email-deliveries/retry",
    requireAuth(["admin"]),
    async (_req, res, next) => {
      try {
        const result = await pool.query(
          "UPDATE email_deliveries SET status='pending',attempts=0,next_attempt=now(),last_error=NULL WHERE status='failed' AND created_at>now()-interval '23 hours'",
        );
        res.json({ queued: Boolean(result.rowCount), count: result.rowCount });
      } catch (e) {
        if (!serviceError(e, res)) next(e);
      }
    },
  );

  app.get("/api/portal/preferences", auth, async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        "SELECT email_updates FROM account_preferences WHERE user_id=$1",
        [(req as any).auth.user.id],
      );
      res.json({ emailUpdates: rows[0]?.email_updates ?? true });
    } catch (e) {
      if (!serviceError(e, res)) next(e);
    }
  });
  app.patch("/api/portal/preferences", auth, async (req, res, next) => {
    try {
      const value = z
        .object({ emailUpdates: z.boolean() })
        .strict()
        .parse(req.body);
      await pool.query(
        "INSERT INTO account_preferences(user_id,email_updates) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET email_updates=$2,updated_at=now()",
        [(req as any).auth.user.id, value.emailUpdates],
      );
      res.json({ ok: true });
    } catch (e) {
      if (e instanceof z.ZodError)
        return res.status(400).json({ code: "validation" });
      if (!serviceError(e, res)) next(e);
    }
  });
}
