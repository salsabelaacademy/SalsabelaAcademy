import type { Express, RequestHandler } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { pool } from "./db";
import { requireAuth } from "./auth";
import { serviceError } from "./service-errors";
import { aiInput, generateAnswer } from "./gemini";
const run =
  (fn: RequestHandler): RequestHandler =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      if (!serviceError(error, res)) next(error);
    }
  };
export function allowedConversation(
  sender: { id: number; role: string },
  recipient: { id: number; role: string; status: string } | undefined,
) {
  return Boolean(
    recipient &&
      recipient.id !== sender.id &&
      recipient.status === "active" &&
      ((sender.role === "admin" && recipient.role === "student") ||
        (sender.role === "student" && recipient.role === "admin")),
  );
}
const limits = async (key: string, maximum: number, seconds: number) => {
  const result = await pool.query(
    `INSERT INTO ai_request_usage(key,count,expires_at) VALUES($1,1,now()+($2*interval '1 second')) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN ai_request_usage.expires_at<now() THEN 1 ELSE ai_request_usage.count+1 END,expires_at=CASE WHEN ai_request_usage.expires_at<now() THEN EXCLUDED.expires_at ELSE ai_request_usage.expires_at END RETURNING count`,
    [key, seconds],
  );
  return result.rows[0].count <= maximum;
};
export function registerConversations(app: Express) {
  const auth = requireAuth(["admin", "student"]);
  const recipient = async (actor: any, value: unknown) => {
    const id = z.coerce.number().int().positive().parse(value);
    return (
      await pool.query("SELECT id,name,role,status FROM users WHERE id=$1", [
        id,
      ])
    ).rows[0];
  };
  app.get(
    "/api/conversations",
    auth,
    run(async (req, res) => {
      const actor = (req as any).auth.user;
      const result = await pool.query(
        `SELECT u.id,u.name,u.role,u.avatar_url AS "avatarUrl",(SELECT count(*)::int FROM messages m WHERE m.sender_id=u.id AND m.recipient_id=$1 AND m.read_at IS NULL) AS unread FROM users u WHERE u.role=$2 AND u.status='active' ORDER BY u.name,u.id`,
        [actor.id, actor.role === "admin" ? "student" : "admin"],
      );
      res.set("Cache-Control", "no-store").json(result.rows);
    }),
  );
  app.get(
    "/api/conversations/:id",
    auth,
    run(async (req, res) => {
      const actor = (req as any).auth.user,
        other = await recipient(actor, req.params.id);
      if (!allowedConversation(actor, other))
        return res.status(403).json({ code: "forbidden" });
      const before = z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .parse(req.query.before);
      const messages = await pool.query(
        "SELECT id,sender_id,recipient_id,subject,body,read_at,created_at FROM messages WHERE ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1)) AND ($3::integer IS NULL OR id<$3) ORDER BY id DESC LIMIT 60",
        [actor.id, other.id, before || null],
      );
      res.set("Cache-Control", "no-store").json({
        messages: messages.rows.reverse(),
        hasMore: messages.rows.length === 60,
      });
    }),
  );
  app.post(
    "/api/conversations/:id/read",
    auth,
    run(async (req, res) => {
      const actor = (req as any).auth.user,
        other = await recipient(actor, req.params.id);
      if (!allowedConversation(actor, other))
        return res.status(403).json({ code: "forbidden" });
      await pool.query(
        "UPDATE messages SET read_at=now() WHERE sender_id=$1 AND recipient_id=$2 AND read_at IS NULL",
        [other.id, actor.id],
      );
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/conversations/:id",
    auth,
    run(async (req, res) => {
      const actor = (req as any).auth.user,
        other = await recipient(actor, req.params.id);
      if (!allowedConversation(actor, other))
        return res.status(403).json({ code: "forbidden" });
      const value = z
        .object({
          body: z.string().trim().min(1).max(5000),
          requestKey: z.string().uuid(),
        })
        .strict()
        .parse(req.body);
      if (!(await limits("message:" + actor.id, 60, 3600)))
        return res.status(429).json({ code: "limited" });
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          actor.id + ":" + value.requestKey,
        ]);
        const prior = (
          await c.query(
            "SELECT id,recipient_id,body FROM messages WHERE sender_id=$1 AND request_key=$2",
            [actor.id, value.requestKey],
          )
        ).rows[0];
        if (prior) {
          await c.query("ROLLBACK");
          if (prior.recipient_id !== other.id || prior.body !== value.body)
            return res.status(409).json({ code: "conflict" });
          return res.json({ id: prior.id, duplicate: true });
        }
        const message = (
          await c.query(
            "INSERT INTO messages(sender_id,recipient_id,subject,body,request_key) VALUES($1,$2,$3,$4,$5) RETURNING id",
            [actor.id, other.id, actor.name, value.body, value.requestKey],
          )
        ).rows[0];
        await c.query("COMMIT");
        res.status(201).json(message);
      } catch (error) {
        await c.query("ROLLBACK");
        throw error;
      } finally {
        c.release();
      }
    }),
  );
  app.get("/api/assistant/config", auth, (_req, res) =>
    res
      .set("Cache-Control", "no-store")
      .json({ configured: Boolean(process.env.GEMINI_API_KEY?.trim()) }),
  );
  app.post(
    "/api/assistant/chat",
    auth,
    run(async (req, res) => {
      const actor = (req as any).auth.user,
        input = aiInput.parse(req.body);
      if (!process.env.GEMINI_API_KEY?.trim())
        return res.status(503).json({ code: "not_configured" });
      const userKey = createHash("sha256")
        .update("ai:" + actor.id)
        .digest("hex");
      if (
        !(await limits(userKey, 20, 3600)) ||
        !(await limits("ai:academy:daily", 200, 86400))
      )
        return res.status(429).json({ code: "limited" });
      // No academy records, private conversation, credentials or tools are supplied to Gemini.
      try {
        res.json({ text: await generateAnswer(input) });
      } catch (error) {
        res.status(503).json({
          code:
            error instanceof Error &&
            ["limited", "not_configured", "ai_credentials"].includes(
              error.message,
            )
              ? error.message
              : "ai_unavailable",
        });
      }
    }),
  );
}
