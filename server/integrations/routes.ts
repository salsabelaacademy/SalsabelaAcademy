import { Router, type Express, type Request } from "express";
import { z } from "zod";
import { followupTranslations } from '../../shared/lesson-followup';
import { pool } from "../db";
import { requireAuth, type AuthUser } from "../auth";
import { configured, decrypt, digest, driveId, frontendOrigin, IntegrationError, safeZoomUrl, validTimezone } from "./security";
import { google, inspectDrive, request, zoom, zoomToken, type GoogleProvider } from "./providers";
import { connection, driveAccess, enabled, googleToken, oauthFinish, oauthStart, providers, queue, resource, statuses, testConnection, withLock, type Kind, type Provider } from "./service";

const id = z.coerce.number().int().positive();
const kindSchema = z.enum(["lesson", "appointment"]);
const providerSchema = z.enum(providers);
const auth = (req: Request) => (req as Request & { auth: { user: AuthUser; token: string } }).auth;
const iso = z.string().datetime({ offset: true }).transform(s => new Date(s));
const timezone = z.string().max(80).refine(validTimezone, "Invalid IANA timezone");
const schedule = z.object({ studentId: id, title: z.string().trim().min(1).max(150), programId: id.optional(), startsAt: iso, endsAt: iso, timezone: timezone.default("UTC") }).refine(x => x.endsAt > x.startsAt && x.endsAt.getTime() - x.startsAt.getTime() <= 24 * 3600000, "Invalid duration");
export async function checkScheduleConflict(start: Date, end: Date, kind: Kind, exceptId = 0) {
  const found = await pool.query(`SELECT id FROM lessons WHERE status='scheduled' AND starts_at<$2 AND ends_at>$1 AND NOT ($3='lesson' AND id=$4) UNION ALL SELECT id FROM appointments WHERE status='confirmed' AND starts_at<$2 AND ends_at>$1 AND NOT ($3='appointment' AND id=$4) LIMIT 1`,[start,end,kind,exceptId]);
  if (found.rows.length) throw new IntegrationError('schedule_conflict',409);
}

export function registerIntegrationRoutes(app: Express) {
  const router = Router();
  app.use("/api", router);

  router.get("/integrations/google/callback", requireAuth(["admin"]), async (req, res) => {
    try {
      const state = z.string().min(20).max(200).parse(req.query.state);
      const code = z.string().min(1).max(4096).parse(req.query.code);
      await withLock(() => oauthFinish(state, code, auth(req).user.id, auth(req).token));
      res.redirect("/admin/integrations?oauth=connected");
    } catch { res.redirect("/admin/integrations?oauth=error"); }
  });
  router.get("/admin/integrations", requireAuth(["admin"]), async (_req, res) => res.json(await statuses()));
  router.post("/admin/integrations/:provider/connect", requireAuth(["admin"]), async (req, res) => {
    const p = providerSchema.parse(req.params.provider);
    if (p !== "zoom") return res.json({ url: await oauthStart(p, auth(req).user.id, auth(req).token) });
    await withLock(async () => {
      await testConnection(p);
      await pool.query("INSERT INTO integration_connections(provider,enabled,last_success) VALUES('zoom',true,now()) ON CONFLICT(provider) DO UPDATE SET enabled=true,error=NULL,last_success=now()");
    });
    res.json({ ok: true });
  });
  router.post("/admin/integrations/:provider/test", requireAuth(["admin"]), async (req, res) => { const p = providerSchema.parse(req.params.provider); await withLock(() => testConnection(p)); res.json({ ok: true }); });
  router.post("/admin/integrations/:provider/disconnect", requireAuth(["admin"]), async (req, res) => {
    const p = providerSchema.parse(req.params.provider);
    await withLock(async () => {
      const c = await connection(p);
      // Disable locally FIRST. Google token revocation can revoke all grants for
      // this OAuth app; clear all three local connections to match that behavior.
      if (p === "zoom") await pool.query("UPDATE integration_connections SET enabled=false,error=NULL WHERE provider='zoom'");
      else {
        await pool.query("UPDATE integration_connections SET enabled=false,secret=NULL,error=NULL WHERE provider<>'zoom'");
        await pool.query("DELETE FROM integration_oauth_states");
        if (c?.secret) {
          try { await request("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: decrypt(c.secret, p) }) }); }
          catch { throw new IntegrationError("revoke_remote_required", 502); }
        }
      }
    }); res.json({ ok: true });
  });
  router.get("/admin/integrations/jobs", requireAuth(["admin"]), async (_req, res) => res.json((await pool.query("SELECT id,kind,resource_id,state,attempts,error,updated_at,next_at FROM integration_jobs ORDER BY updated_at DESC LIMIT 100")).rows));
  router.post("/admin/integrations/jobs/:id/retry", requireAuth(["admin"]), async (req, res) => {
    await withLock(async () => {
      const result = await pool.query("UPDATE integration_jobs SET state='pending',attempts=0,error=NULL,next_at=now() WHERE id=$1 AND state='failed' RETURNING id", [id.parse(req.params.id)]);
      if (!result.rowCount) throw new IntegrationError("resource_missing", 404);
    }); res.status(202).json({ queued: true });
  });
  router.post("/admin/integrations/sync/:kind/:id", requireAuth(["admin"]), async (req, res) => {
    const kind = kindSchema.parse(req.params.kind), itemId = id.parse(req.params.id);
    await withLock(async () => { if (!(await resource(kind, itemId))) throw new IntegrationError("resource_missing", 404); await queue(kind, itemId); });
    res.status(202).json({ queued: true });
  });
  // Host links are retrieved on explicit admin action, never stored or listed.
  router.post("/admin/integrations/host/:kind/:id", requireAuth(["admin"]), async (req, res) => {
    const kind = kindSchema.parse(req.params.kind), itemId = id.parse(req.params.id);
    const r = await resource(kind, itemId);
    if (!r || !["scheduled", "confirmed"].includes(r.status) || !r.ends_at || r.ends_at < new Date() || !(await enabled("zoom"))) throw new IntegrationError("resource_missing", 404);
    const m = (await pool.query("SELECT zoom_id FROM integration_meetings WHERE key=$1 AND create_state='ready'", [`${kind}:${itemId}`])).rows[0];
    if (!m?.zoom_id) throw new IntegrationError("resource_missing", 404);
    const meeting = await zoom(`/meetings/${m.zoom_id}`, await zoomToken());
    res.json({ url: safeZoomUrl(meeting.start_url) });
  });
  // Recovery never creates another meeting: admin can adopt a verified marker match.
  router.post("/admin/integrations/recover/:kind/:id", requireAuth(["admin"]), async (req, res) => {
    const kind = kindSchema.parse(req.params.kind), itemId = id.parse(req.params.id), zoomId = z.string().regex(/^\d{9,12}$/).parse(req.body.zoomId);
    await withLock(async () => {
      const key = `${kind}:${itemId}`;
      if (!(await resource(kind, itemId)) || !(await enabled("zoom"))) throw new IntegrationError("resource_missing", 404);
      const details = await zoom(`/meetings/${zoomId}`, await zoomToken());
      if (details.agenda !== `Salsabela:${digest(`${frontendOrigin()}:${key}`).slice(0, 32)}`) throw new IntegrationError("permission_denied", 403);
      const result = await pool.query("UPDATE integration_meetings SET zoom_id=$2,join_url=$3,create_state='ready' WHERE key=$1 AND create_state='creating' AND zoom_id IS NULL RETURNING key", [key, zoomId, safeZoomUrl(details.join_url)]);
      if (!result.rowCount) throw new IntegrationError("resource_missing", 404);
      await queue(kind, itemId);
    }); res.json({ queued: true });
  });

  router.get("/admin/integrations/sessions", requireAuth(["admin"]), async (_req, res) => {
    const result = await pool.query(`SELECT 'lesson' AS kind,id,student_id,title,starts_at,ends_at,status FROM lessons UNION ALL SELECT 'appointment',id,student_id,appointment_type,starts_at,ends_at,status FROM appointments ORDER BY starts_at DESC NULLS LAST LIMIT 100`);
    res.json(result.rows);
  });
  router.post("/admin/lessons", requireAuth(["admin"]), async (req, res) => {
    const data = schedule.parse(req.body);
    const student = (await pool.query("SELECT id FROM users WHERE id=$1 AND role='student' AND status='active'", [data.studentId])).rows[0];
    if (!student) throw new IntegrationError("student_inactive", 400);
    if (data.programId && !(await pool.query("SELECT id FROM enrollments WHERE student_id=$1 AND program_id=$2 AND status='active'", [data.studentId, data.programId])).rowCount) throw new IntegrationError("permission_denied", 403);
    const row = await withLock(async () => {
      await checkScheduleConflict(data.startsAt,data.endsAt,'lesson');
      const row = (await pool.query("INSERT INTO lessons(student_id,program_id,title,starts_at,ends_at) VALUES($1,$2,$3,$4,$5) RETURNING *", [data.studentId, data.programId || null, data.title, data.startsAt, data.endsAt])).rows[0];
      await pool.query("INSERT INTO integration_meetings(key,timezone) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET timezone=$2", [`lesson:${row.id}`, data.timezone]);
      await pool.query('INSERT INTO academy_audit(actor_id,action,resource) VALUES($1,$2,$3)',[auth(req).user.id,'lesson_created',`lesson:${row.id}`]);
      await queue("lesson", row.id); return row;
    }); res.status(201).json(row);
  });
  for (const kind of ["lesson", "appointment"] as const) {
    router.patch(`/admin/${kind}s/:id`, requireAuth(["admin"]), async (req, res) => {
      const itemId = id.parse(req.params.id);
      const body = z.object({ startsAt: iso.optional(), endsAt: iso.optional(), status: z.enum(kind === "lesson" ? ["scheduled", "completed", "cancelled"] : ["requested", "confirmed", "completed", "cancelled", "no_show"]).optional(), timezone: timezone.optional() }).strict().parse(req.body);
      await withLock(async () => {
        const old = await resource(kind, itemId); if (!old) throw new IntegrationError("resource_missing", 404);
        if (old.status === "cancelled" && ((body.status && body.status !== "cancelled") || body.startsAt || body.endsAt)) throw new IntegrationError("cancelled_terminal", 409);
        if (old.status === 'completed' && (body.startsAt || body.endsAt)) throw new IntegrationError('completed_terminal',409);
        const start = body.startsAt || (old.starts_at ? new Date(old.starts_at) : null), end = body.endsAt || (old.ends_at ? new Date(old.ends_at) : null);
        if (!start || !end || end <= start || end.getTime()-start.getTime()>24*3600000) throw new IntegrationError("invalid_time");
        if (['scheduled','confirmed'].includes(body.status || old.status)) await checkScheduleConflict(start,end,kind,itemId);
        const table = kind === "lesson" ? "lessons" : "appointments";
        const changedTime=new Date(old.starts_at).getTime()!==start.getTime() || new Date(old.ends_at).getTime()!==end.getTime();
        await pool.query(`UPDATE ${table} SET starts_at=$2,ends_at=$3,status=$4,updated_at=now() WHERE id=$1`, [itemId, start, end, body.status || old.status]);
        if (kind==='lesson' && changedTime) {
          const profile=(await pool.query('SELECT timezone,preferred_language FROM student_profiles WHERE user_id=$1',[old.student_id])).rows[0];
          const language=['ar','Arabic'].includes(profile?.preferred_language)?'ar':'en',zone=validTimezone(profile?.timezone)?profile.timezone:'UTC';
          const format=new Intl.DateTimeFormat(language,{dateStyle:'medium',timeStyle:'short',timeZone:zone});
          const tr=followupTranslations[language];
          await pool.query("UPDATE notifications SET body=$2 WHERE id=(SELECT id FROM notifications WHERE user_id=$1 AND title='notify_lesson' ORDER BY id DESC LIMIT 1)",[old.student_id,`${old.title}\n${tr.reschedule}\n${tr.start}: ${format.format(start)}\n${tr.end}: ${format.format(end)} · ${zone}`]);
        }
        if (kind === "appointment" && body.timezone) await pool.query("UPDATE appointments SET original_timezone=$2 WHERE id=$1", [itemId, body.timezone]);
        if (body.timezone) await pool.query("INSERT INTO integration_meetings(key,timezone) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET timezone=$2", [`${kind}:${itemId}`, body.timezone]);
        if(changedTime || (body.status && body.status!==old.status))await pool.query('INSERT INTO academy_audit(actor_id,action,resource) VALUES($1,$2,$3)',[auth(req).user.id,`${kind}_${changedTime?'rescheduled':body.status}`,`${kind}:${itemId}`]);
        await queue(kind, itemId);
      }); res.json({ queued: true });
    });
  }
  router.get("/student/sessions", requireAuth(["student"]), async (req, res) => {
    const rows = (await pool.query(`SELECT 'lesson' AS kind,id,title,starts_at,ends_at,status FROM lessons WHERE student_id=$1 UNION ALL SELECT 'appointment',id,appointment_type,starts_at,ends_at,status FROM appointments WHERE student_id=$1 ORDER BY starts_at DESC NULLS LAST LIMIT 100`, [auth(req).user.id])).rows;
    const available = await enabled("zoom");
    const profile = (await pool.query("SELECT timezone FROM student_profiles WHERE user_id=$1", [auth(req).user.id])).rows[0];
    const timezone = profile?.timezone && validTimezone(profile.timezone) ? profile.timezone : "UTC";
    res.json(await Promise.all(rows.map(async r => {
      const joinable = available && ["scheduled", "confirmed"].includes(r.status) && r.ends_at && r.ends_at > new Date();
      const m = joinable ? (await pool.query("SELECT join_url FROM integration_meetings WHERE key=$1 AND create_state='ready'", [`${r.kind}:${r.id}`])).rows[0] : null;
      return { ...r, timezone, joinUrl: m?.join_url || null };
    })));
  });

  router.get("/admin/integrations/classroom/courses", requireAuth(["admin"]), async (req, res) => {
    const token = await googleToken("classroom");
    const pageToken = z.string().max(2000).optional().parse(req.query.pageToken);
    const page = await google("classroom", `/courses?teacherId=me&courseStates=ACTIVE&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`, token);
    res.json({ courses: (page.courses || []).map((c: any) => ({ id: c.id, name: c.name })), nextPageToken: page.nextPageToken || null });
  });
  router.get("/admin/integrations/classroom/links", requireAuth(["admin"]), async (_req, res) => res.json((await pool.query("SELECT * FROM integration_classroom_links ORDER BY enrollment_id")).rows));
  router.post("/admin/integrations/classroom/link", requireAuth(["admin"]), async (req, res) => {
    const data = z.object({ enrollmentId: id, courseId: z.string().regex(/^[\w-]{1,100}$/) }).parse(req.body);
    await withLock(async () => {
      const enrollment = (await pool.query("SELECT e.id FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.id=$1 AND e.status='active' AND u.role='student' AND u.status='active'", [data.enrollmentId])).rows[0];
      if (!enrollment) throw new IntegrationError("student_inactive", 400);
      await google("classroom", `/courses/${data.courseId}/teachers/me`, await googleToken("classroom"));
      const old = (await pool.query("SELECT course_id FROM integration_classroom_links WHERE enrollment_id=$1", [data.enrollmentId])).rows[0];
      if (old && old.course_id !== data.courseId) throw new IntegrationError("classroom_link_exists", 409);
      await pool.query("INSERT INTO integration_classroom_links(enrollment_id,course_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [data.enrollmentId, data.courseId]);
      await pool.query("INSERT INTO integration_jobs(key,kind,resource_id) VALUES($1,'classroom',$2) ON CONFLICT(key) DO UPDATE SET state='pending',attempts=0,error=NULL,next_at=now()", [`classroom:${data.enrollmentId}`, data.enrollmentId]);
    }); res.status(202).json({ queued: true });
  });
  router.post("/admin/integrations/drive/inspect", requireAuth(["admin"]), async (req, res) => {
    const fileId = driveId(z.string().max(1000).parse(req.body.url));
    const result = await inspectDrive(fileId, await googleToken("drive"));
    res.json({ fileId, name: result.name, public: result.public });
  });
  router.post("/admin/integrations/drive/attach", requireAuth(["admin"]), async (req, res) => {
    const body = z.object({ unitId: id, title: z.string().trim().min(1).max(200), url: z.string().max(1000) }).parse(req.body);
    const fileId = driveId(body.url);
    if (!(await pool.query("SELECT id FROM curriculum_units WHERE id=$1", [body.unitId])).rowCount) throw new IntegrationError("resource_missing", 404);
    const inspection = await inspectDrive(fileId, await googleToken("drive"));
    if (inspection.public) throw new IntegrationError("drive_public", 409);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const m = (await client.query("INSERT INTO materials(unit_id,title) VALUES($1,$2) RETURNING id", [body.unitId, body.title])).rows[0];
      await client.query("INSERT INTO integration_drive_resources(material_id,file_id) VALUES($1,$2)", [m.id, fileId]);
      await client.query("COMMIT"); res.status(201).json({ materialId: m.id });
    } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  });
  router.get("/admin/materials/assignments", requireAuth(["admin"]), async (_req, res) => res.json((await pool.query("SELECT a.id,m.title,u.name FROM assigned_materials a JOIN materials m ON m.id=a.material_id JOIN enrollments e ON e.id=a.enrollment_id JOIN users u ON u.id=e.student_id ORDER BY a.id DESC")).rows));
  router.delete("/admin/materials/assignments/:id", requireAuth(["admin"]), async (req, res) => {
    const result = await pool.query("DELETE FROM assigned_materials WHERE id=$1 RETURNING id", [id.parse(req.params.id)]);
    if (!result.rowCount) throw new IntegrationError("resource_missing", 404);
    res.json({ ok: true, externalPermissionUnchanged: true });
  });
  router.get("/student/drive-materials", requireAuth(["student"]), async (req, res) => res.json((await pool.query(`SELECT a.id,m.title FROM assigned_materials a JOIN enrollments e ON e.id=a.enrollment_id JOIN materials m ON m.id=a.material_id JOIN integration_drive_resources r ON r.material_id=m.id WHERE e.student_id=$1 AND e.status='active'`, [auth(req).user.id])).rows));
  router.post("/student/drive-materials/:id/open", requireAuth(["student"]), async (req, res) => res.json({ url: await driveAccess(id.parse(req.params.id), auth(req).user.id) }));

  router.use((error: unknown, _req: Request, res: import("express").Response, _next: import("express").NextFunction) => {
    if (error instanceof z.ZodError) return res.status(400).json({ code: "invalid_input", message: "Invalid input" });
    if (error instanceof IntegrationError) return res.status(error.status >= 400 && error.status <= 599 ? error.status : 502).json({ code: error.code, message: error.code });
    res.status(500).json({ code: "internal_error", message: "Operation failed" });
  });
}
