import type { Express, Response } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "./db";
import { requireAuth } from "./auth";
import { serviceError } from "./service-errors";

const safeCodes = new Set([
  "42P01", "42703", "42501", "23502", "23503", "23505", "42883", "57014",
  "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "57P01", "53300",
]);

export function messageFailure(error: unknown, res: Response, stage: string) {
  const code = (error as { code?: string })?.code || "unclassified";
  const reference = res.locals.requestId || randomUUID();
  res.locals.requestId = reference;
  console.error(JSON.stringify({
    event: "conversation_failure", requestId: reference, stage,
    code: safeCodes.has(code) ? code : "unclassified",
  }));
  res.setHeader("X-Request-ID", reference);
  if (!serviceError(error, res)) {
    res.status(503).json({ code: "message_storage_error", reference });
  }
}

export function registerMessageDiagnostics(app: Express) {
  app.post("/api/admin/conversations/check", requireAuth(["admin"]), async (req, res) => {
    const actor = (req as any).auth.user;
    let c;
    let stage = "rate_limit";
    try {
      // Count every attempt atomically, including failed checks. No message is committed.
      const usage = (await pool.query(
        `INSERT INTO ai_request_usage(key,count,expires_at)
         VALUES($1,1,now()+interval '5 minutes') ON CONFLICT(key) DO UPDATE
         SET count=CASE WHEN ai_request_usage.expires_at<now() THEN 1 ELSE ai_request_usage.count+1 END,
         expires_at=CASE WHEN ai_request_usage.expires_at<now() THEN EXCLUDED.expires_at ELSE ai_request_usage.expires_at END
         RETURNING count`, ["message-check:" + actor.id],
      )).rows[0];
      if (usage.count > 3) return res.status(429).json({ code: "limited" });

      stage = "connect";
      c = await pool.connect();
      await c.query("BEGIN");
      await c.query("SET LOCAL statement_timeout='5s'");
      stage = "recipient";
      const student = (await c.query(
        "SELECT id FROM users WHERE role='student' AND status='active' ORDER BY id LIMIT 1",
      )).rows[0];
      if (!student) {
        await c.query("ROLLBACK");
        return res.status(409).json({ code: "no_active_student" });
      }
      const previous = (await c.query(
        "SELECT COALESCE(max(id),0) AS id FROM notifications WHERE user_id=$1", [student.id],
      )).rows[0].id;
      stage = "message_insert";
      const result = (await c.query(
        "INSERT INTO messages(sender_id,recipient_id,subject,body,request_key) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [actor.id, student.id, "Academy storage diagnostic", "Rollback-only storage check", randomUUID()],
      )).rows[0];
      stage = "notification_pipeline";
      const notification = (await c.query(
        "SELECT id FROM notifications WHERE user_id=$1 AND title='notify_message' AND body='Academy storage diagnostic' AND id>$2 ORDER BY id DESC LIMIT 1",
        [student.id, previous],
      )).rows[0];
      const queued = notification ? Boolean((await c.query(
        "SELECT 1 FROM email_deliveries WHERE notification_id=$1", [notification.id],
      )).rowCount) : false;
      await c.query("ROLLBACK");
      res.set("Cache-Control", "no-store").json({
        storageReady: Boolean(result.id), notificationReady: Boolean(notification),
        emailQueued: queued, rolledBack: true, providersTested: false,
      });
    } catch (error) {
      if (c) await c.query("ROLLBACK").catch(() => {});
      messageFailure(error, res, stage);
    } finally {
      c?.release();
    }
  });
}
