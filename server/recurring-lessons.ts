import type { Express } from "express";
import { createHash } from "node:crypto";
import { pool } from "./db";
import { requireAuth } from "./auth";
import { recurringInput, expandRecurring } from "../shared/recurring-schedule";
import { withLock } from "./integrations/service";
export function registerRecurringLessons(app: Express) {
  app.post(
    "/api/admin/lesson-series",
    requireAuth(["admin"]),
    async (req, res, next) => {
      try {
        const data = recurringInput.parse(req.body),
          actor = (req as any).auth.user.id,
          hash = createHash("sha256")
            .update(JSON.stringify(data))
            .digest("hex");
        const result = await withLock(async () => {
          const c = await pool.connect();
          try {
            await c.query("BEGIN");
            const prior = (
              await c.query(
                "SELECT id,actor_id,payload_hash FROM lesson_series WHERE request_key=$1",
                [data.requestKey],
              )
            ).rows[0];
            if (prior) {
              if (prior.actor_id !== actor || prior.payload_hash !== hash) {
                await c.query("ROLLBACK");
                return { code: "conflict", status: 409 };
              }
              const lessons = (
                await c.query(
                  "SELECT id,starts_at,ends_at FROM lessons WHERE series_id=$1 ORDER BY starts_at",
                  [prior.id],
                )
              ).rows;
              await c.query("COMMIT");
              return { id: prior.id, lessons, duplicate: true };
            }
            const times = expandRecurring(data);
            if (times[0].startsAt <= new Date()) {
              await c.query("ROLLBACK");
              return { code: "invalid_time", status: 400 };
            }
            if (
              !(
                await c.query(
                  "SELECT id FROM users WHERE id=$1 AND role='student' AND status='active' FOR UPDATE",
                  [data.studentId],
                )
              ).rowCount
            ) {
              await c.query("ROLLBACK");
              return { code: "student_inactive", status: 400 };
            }
            if (
              data.programId &&
              !(
                await c.query(
                  "SELECT id FROM enrollments WHERE student_id=$1 AND program_id=$2 AND status='active'",
                  [data.studentId, data.programId],
                )
              ).rowCount
            ) {
              await c.query("ROLLBACK");
              return { code: "permission_denied", status: 403 };
            }
            for (const time of times) {
              const conflict = await c.query(
                "SELECT id FROM lessons WHERE status='scheduled' AND starts_at<$2 AND ends_at>$1 UNION ALL SELECT id FROM appointments WHERE status='confirmed' AND starts_at<$2 AND ends_at>$1 LIMIT 1",
                [time.startsAt, time.endsAt],
              );
              if (conflict.rowCount) {
                await c.query("ROLLBACK");
                return { code: "schedule_conflict", status: 409 };
              }
            }
            const series = (
              await c.query(
                "INSERT INTO lesson_series(actor_id,student_id,request_key,payload_hash,timezone) VALUES($1,$2,$3,$4,$5) RETURNING id",
                [actor, data.studentId, data.requestKey, hash, data.timezone],
              )
            ).rows[0];
            const lessons = [];
            for (const time of times) {
              const lesson = (
                await c.query(
                  "INSERT INTO lessons(student_id,program_id,title,starts_at,ends_at,series_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,starts_at,ends_at",
                  [
                    data.studentId,
                    data.programId || null,
                    data.title,
                    time.startsAt,
                    time.endsAt,
                    series.id,
                  ],
                )
              ).rows[0];
              lessons.push(lesson);
              await c.query(
                "INSERT INTO integration_meetings(key,timezone) VALUES($1,$2)",
                [`lesson:${lesson.id}`, data.timezone],
              );
              await c.query(
                "INSERT INTO integration_jobs(key,kind,resource_id) VALUES($1,'lesson',$2) ON CONFLICT(key) DO NOTHING",
                [`lesson:${lesson.id}`, lesson.id],
              );
            }
            await c.query(
              "INSERT INTO academy_audit(actor_id,action,resource) VALUES($1,$2,$3)",
              [actor, "lesson_series_created", `series:${series.id}`],
            );
            await c.query("COMMIT");
            return { id: series.id, lessons };
          } catch (error) {
            await c.query("ROLLBACK");
            throw error;
          } finally {
            c.release();
          }
        });
        if ("code" in result)
          return res.status(result.status!).json({ code: result.code });
        res.status(result.duplicate ? 200 : 201).json(result);
      } catch (error) {
        if (
          error instanceof Error &&
          ["dst_time", "range", "schedule_conflict"].includes(error.message)
        )
          return res.status(400).json({ code: error.message });
        next(error);
      }
    },
  );
}
