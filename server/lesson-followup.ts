import type { Express, RequestHandler } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { pool } from "./db";
import { requireAuth } from "./auth";
import { followupTranslations, issueKinds } from "../shared/lesson-followup";

const common = {
  requestKey: z.string().uuid(),
  comment: z.string().trim().max(3000).default(""),
};
const schema = z.discriminatedUnion("kind", [
  z
    .object({
      ...common,
      kind: z.literal("report"),
      covered: z.string().trim().min(1).max(3000),
      adjustPlan: z.boolean().default(false),
      behavior: z.number().int().min(1).max(5),
      participation: z.number().int().min(1).max(5),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal("issue"),
      issueKind: z.enum(issueKinds),
    })
    .strict(),
]);
const run =
  (handler: RequestHandler): RequestHandler =>
  async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ code: "invalid" });
        return;
      }
      next(e);
    }
  };
export function registerLessonFollowups(app: Express) {
  app.get(
    "/api/portal/lesson-updates",
    requireAuth(["admin", "student"]),
    run(async (req, res) => {
      const user = (req as any).auth.user;
      // Explicit projection: never return idempotency hashes, host URLs, or private notes.
      const result = await pool.query(
        `SELECT f.id,f.lesson_id,f.student_id,f.kind,f.issue_kind,f.covered,f.adjust_plan,f.behavior,f.participation,f.comment,f.created_at,l.title,l.starts_at FROM lesson_followups f JOIN lessons l ON l.id=f.lesson_id ${user.role === "admin" ? "" : "WHERE f.student_id=$1 AND l.student_id=$1"} ORDER BY f.created_at DESC LIMIT 500`,
        user.role === "admin" ? [] : [user.id],
      );
      res.set("Cache-Control", "no-store").json(result.rows);
    }),
  );
  app.post(
    "/api/admin/lessons/:id/followup",
    requireAuth(["admin"]),
    run(async (req, res) => {
      const lessonId = z.coerce.number().int().positive().parse(req.params.id),
        body = schema.parse(req.body),
        actor = (req as any).auth.user.id;
      const hash = createHash("sha256")
        .update(JSON.stringify({ lessonId, ...body }))
        .digest("hex");
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        // Serialize equal request keys even when submitted concurrently for different lessons.
        await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          body.requestKey,
        ]);
        await c.query("SELECT pg_advisory_xact_lock(730039,$1)", [actor]);
        const prior = (
          await c.query(
            "SELECT id,actor_id,payload_hash FROM lesson_followups WHERE request_key=$1",
            [body.requestKey],
          )
        ).rows[0];
        if (prior) {
          await c.query("ROLLBACK");
          if (prior.actor_id !== actor || prior.payload_hash !== hash)
            return res.status(409).json({ code: "conflict" });
          return res.json({ ok: true, id: prior.id, duplicate: true });
        }
        const lesson = (
          await c.query(
            "SELECT l.*,p.preferred_language FROM lessons l LEFT JOIN student_profiles p ON p.user_id=l.student_id WHERE l.id=$1 FOR UPDATE OF l",
            [lessonId],
          )
        ).rows[0];
        if (!lesson) {
          await c.query("ROLLBACK");
          return res.status(404).json({ code: "missing" });
        }
        if (lesson.status === "cancelled") {
          await c.query("ROLLBACK");
          return res.status(409).json({ code: "cancelled" });
        }
        if (
          body.kind === "report" &&
          (
            await c.query(
              "SELECT lesson_id FROM lesson_report_claims WHERE lesson_id=$1",
              [lessonId],
            )
          ).rows.length
        ) {
          await c.query("ROLLBACK");
          return res.status(409).json({ code: "reportExists" });
        }
        if (
          body.kind === "report" &&
          (!lesson.starts_at ||
            new Date(lesson.starts_at).getTime() > Date.now())
        ) {
          await c.query("ROLLBACK");
          return res.status(409).json({ code: "reportFuture" });
        }
        if (body.kind === "report") {
          // Completion and report commit together; attendance is recorded separately.
          await c.query(
            "UPDATE lessons SET status='completed',updated_at=now() WHERE id=$1 AND status<>'completed'",
            [lessonId],
          );
        }
        if (
          body.kind === "issue" &&
          body.issueKind === "reminder" &&
          (lesson.status !== "scheduled" ||
            !lesson.ends_at ||
            new Date(lesson.ends_at).getTime() <= Date.now())
        ) {
          await c.query("ROLLBACK");
          return res.status(409).json({ code: "missing" });
        }
        const count = (
          await c.query(
            "SELECT count(*)::int AS total FROM lesson_followups WHERE actor_id=$1 AND created_at>now()-interval '1 hour'",
            [actor],
          )
        ).rows[0].total;
        if (count >= 60) {
          await c.query("ROLLBACK");
          res.set("Retry-After", "3600");
          return res.status(429).json({ code: "limited" });
        }
        const result = await c.query(
          "INSERT INTO lesson_followups(lesson_id,student_id,actor_id,request_key,payload_hash,kind,issue_kind,covered,behavior,participation,comment,adjust_plan) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id",
          [
            lessonId,
            lesson.student_id,
            actor,
            body.requestKey,
            hash,
            body.kind,
            body.kind === "issue" ? body.issueKind : null,
            body.kind === "report" ? body.covered : "",
            body.kind === "report" ? body.behavior : null,
            body.kind === "report" ? body.participation : null,
            body.comment,
            body.kind === "report" ? body.adjustPlan : false,
          ],
        );
        if (
          body.kind === "issue" &&
          [
            "absence_first",
            "absence_second",
            "absence_third",
            "apologized",
            "early_leave",
          ].includes(body.issueKind)
        ) {
          if (
            !lesson.starts_at ||
            (body.issueKind.startsWith("absence") &&
              new Date(lesson.starts_at).getTime() > Date.now())
          ) {
            await c.query("ROLLBACK");
            return res.status(400).json({ code: "invalid" });
          }
          const status = body.issueKind.startsWith("absence")
            ? "absent"
            : body.issueKind === "apologized"
              ? "excused"
              : "present";
          await c.query(
            "UPDATE lessons SET attendance=$2,updated_at=now() WHERE id=$1",
            [lessonId, status],
          );
          await c.query(
            "DELETE FROM attendance_records WHERE student_id=$1 AND course=$2",
            [lesson.student_id, `lesson:${lessonId}`],
          );
          await c.query(
            "INSERT INTO attendance_records(student_id,instructor_id,course,session_date,status) VALUES($1,$2,$3,$4,$5)",
            [
              lesson.student_id,
              actor,
              `lesson:${lessonId}`,
              lesson.starts_at,
              status,
            ],
          );
        }
        const tr =
          followupTranslations[
            ["ar", "Arabic"].includes(lesson.preferred_language) ? "ar" : "en"
          ];
        const message =
          body.kind === "report"
            ? `${lesson.title}\n${tr.covered}: ${body.covered}\n${tr.behavior}: ${body.behavior}/5\n${tr.participation}: ${body.participation}/5${body.adjustPlan ? "\n" + tr.adjustPlan : ""}${body.comment ? "\n" + body.comment : ""}`
            : `${lesson.title}\n${tr[body.issueKind]}${body.comment ? "\n" + body.comment : ""}`;
        // The existing notification trigger creates phone outbox jobs in this same transaction.
        await c.query(
          "INSERT INTO notifications(user_id,title,body) VALUES($1,$2,$3)",
          [
            lesson.student_id,
            body.kind === "report" ? tr.reportReceived : tr.issueReceived,
            message,
          ],
        );
        await c.query(
          "INSERT INTO academy_audit(actor_id,action,resource) VALUES($1,$2,$3)",
          [actor, `lesson_${body.kind}`, `lesson:${lessonId}`],
        );
        await c.query("COMMIT");
        res.status(201).json({ ok: true, id: result.rows[0].id });
      } catch (e) {
        await c.query("ROLLBACK");
        if ((e as any)?.constraint === "lesson_report_once")
          return res.status(409).json({ code: "reportExists" });
        throw e;
      } finally {
        c.release();
      }
    }),
  );
}
