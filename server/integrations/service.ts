import { randomBytes } from "node:crypto";
import { pool } from "../db";
import { configured, decrypt, digest, encrypt, frontendOrigin, IntegrationError, safeZoomUrl } from "./security";
import { exchangeGoogle, google, inspectDrive, scopes, zoom, zoomToken, meetingBody, calendarBody, type GoogleProvider } from "./providers";

export const providers = ["zoom", "calendar", "classroom", "drive"] as const;
export type Provider = typeof providers[number];
export type Kind = "lesson" | "appointment";
type Connection = { provider: Provider; enabled: boolean; secret: string | null; last_success: Date | null; error: string | null };
export async function connection(p: Provider): Promise<Connection | undefined> { return (await pool.query("SELECT * FROM integration_connections WHERE provider=$1", [p])).rows[0]; }
export async function mark(p: Provider, error: string | null) {
  await pool.query("UPDATE integration_connections SET error=$2,last_success=CASE WHEN $2::text IS NULL THEN now() ELSE last_success END WHERE provider=$1", [p, error]);
}
export async function enabled(p: Provider) { return configured(p) && Boolean((await connection(p))?.enabled); }
export async function googleToken(p: GoogleProvider) {
  const row = await connection(p);
  if (!configured(p) || !row?.enabled || !row.secret) throw new IntegrationError("not_configured", 503);
  try {
    const result = await exchangeGoogle({ grant_type: "refresh_token", refresh_token: decrypt(row.secret, p) });
    if (!result.access_token) throw new IntegrationError("credentials_revoked", 401);
    if (result.refresh_token) await pool.query("UPDATE integration_connections SET secret=$2 WHERE provider=$1", [p, encrypt(result.refresh_token, p)]);
    return result.access_token as string;
  } catch (e) {
    const code = e instanceof IntegrationError && e.retryable ? e.code : "credentials_revoked";
    await mark(p, code); throw new IntegrationError(code, 502, e instanceof IntegrationError && e.retryable);
  }
}
export async function statuses() {
  return Promise.all(providers.map(async p => {
    const c = await connection(p), ready = configured(p);
    return { provider: p, configured: ready, enabled: !!c?.enabled, status: !ready ? "not_configured" : !c?.enabled ? "disconnected" : c.error ? "error" : "connected", lastSuccess: c?.last_success || null, error: c?.error || null };
  }));
}
export async function oauthStart(p: GoogleProvider, userId: number, session: string) {
  if (!configured(p)) throw new IntegrationError("not_configured", 503);
  const state = randomBytes(32).toString("base64url");
  await pool.query("DELETE FROM integration_oauth_states WHERE expires_at < now() OR (user_id=$1 AND provider=$2)", [userId, p]);
  await pool.query("INSERT INTO integration_oauth_states(hash,user_id,session_hash,provider,expires_at) VALUES($1,$2,$3,$4,now()+interval '10 minutes')", [digest(state), userId, digest(session), p]);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: `${frontendOrigin()}/api/integrations/google/callback`, response_type: "code", scope: scopes[p].join(" "), access_type: "offline", prompt: "consent", state }).toString();
  return url.href;
}
export async function oauthFinish(state: string, code: string, userId: number, session: string) {
  const row = (await pool.query("DELETE FROM integration_oauth_states WHERE hash=$1 AND user_id=$2 AND session_hash=$3 AND expires_at>now() RETURNING provider", [digest(state), userId, digest(session)])).rows[0];
  if (!row) throw new IntegrationError("oauth_state_invalid", 400);
  const p = row.provider as GoogleProvider;
  const tokens = await exchangeGoogle({ code, grant_type: "authorization_code", redirect_uri: `${frontendOrigin()}/api/integrations/google/callback` });
  if (!tokens.refresh_token || !scopes[p].every(s => String(tokens.scope || "").split(" ").includes(s))) throw new IntegrationError("permission_denied", 403);
  await pool.query("INSERT INTO integration_connections(provider,enabled,secret,last_success,error) VALUES($1,true,$2,now(),NULL) ON CONFLICT(provider) DO UPDATE SET enabled=true,secret=EXCLUDED.secret,last_success=now(),error=NULL", [p, encrypt(tokens.refresh_token, p)]);
}
export async function testConnection(p: Provider) {
  try {
    if (!configured(p)) throw new IntegrationError("not_configured", 503);
    if (p === "zoom") {
      await zoom(`/users/${encodeURIComponent(process.env.ZOOM_HOST_USER_ID!)}`, await zoomToken());
    } else {
      const token = await googleToken(p);
      await google(p, p === "calendar" ? `/calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || "primary")}/events?maxResults=1` : p === "classroom" ? "/courses?pageSize=1&teacherId=me" : "/files?pageSize=1&fields=files(id)", token);
    }
    await mark(p, null);
  } catch (e) { await mark(p, e instanceof IntegrationError ? e.code : "provider_error"); throw e; }
}

export async function queue(kind: Kind, id: number) {
  await pool.query(`INSERT INTO integration_jobs(key,kind,resource_id) VALUES($1,$2,$3)
    ON CONFLICT(key) DO UPDATE SET state='pending',attempts=0,error=NULL,next_at=now(),generation=integration_jobs.generation+1,updated_at=now()`, [`${kind}:${id}`, kind, id]);
}
export async function resource(kind: Kind, id: number) {
  const table = kind === "lesson" ? "lessons" : "appointments";
  return (await pool.query(`SELECT r.*,coalesce(p.timezone,'UTC') AS timezone FROM ${table} r LEFT JOIN student_profiles p ON p.user_id=r.student_id WHERE r.id=$1`, [id])).rows[0];
}
export async function syncResource(kind: Kind, id: number) {
  const item = await resource(kind, id);
  if (!item) throw new IntegrationError("resource_missing", 404);
  const key = `${kind}:${id}`, marker = `Salsabela:${digest(`${frontendOrigin()}:${key}`).slice(0, 32)}`;
  await pool.query("INSERT INTO integration_meetings(key) VALUES($1) ON CONFLICT DO NOTHING", [key]);
  const meeting = (await pool.query("SELECT * FROM integration_meetings WHERE key=$1", [key])).rows[0];
  const cancelled = item.status === "cancelled";
  if (!cancelled && !["scheduled", "confirmed"].includes(item.status)) return;
  if (!cancelled && (!item.starts_at || !item.ends_at)) throw new IntegrationError("invalid_time");
  const title = kind === "lesson" ? item.title : `Salsabela Academy — ${item.appointment_type}`;
  let joinUrl: string | null = meeting.join_url;
  // Disabled providers do not block the academy. Existing external resources remain
  // marked as requiring reconnection instead of pretending cancellation succeeded.
  if (await enabled("zoom")) {
    const token = await zoomToken();
    const path = `/users/${encodeURIComponent(process.env.ZOOM_HOST_USER_ID!)}/meetings`;
    if (meeting.create_state === "creating" && !meeting.zoom_id) {
      // Zoom create has no general idempotency key. After a lost response, reconcile
      // by our exact agenda marker; NEVER blindly POST again.
      let next = ""; let found: any;
      do {
        const page = await zoom(`${path}?type=scheduled&page_size=300&next_page_token=${encodeURIComponent(next)}`, token);
        for (const m of page.meetings || []) {
          // Some Zoom list responses omit agenda: fetch details when necessary.
          const detail = m.agenda === undefined ? await zoom(`/meetings/${encodeURIComponent(String(m.id))}`, token) : m;
          if (detail.agenda === marker) { found = detail; break; }
        }
        next = page.next_page_token || "";
      } while (next && !found);
      if (!found) throw new IntegrationError("zoom_create_uncertain", 409);
      meeting.zoom_id = String(found.id);
      const details = await zoom(`/meetings/${meeting.zoom_id}`, token);
      joinUrl = safeZoomUrl(details.join_url);
      await pool.query("UPDATE integration_meetings SET zoom_id=$2,join_url=$3,create_state='ready' WHERE key=$1", [key, meeting.zoom_id, joinUrl]);
    }
    if (cancelled) {
      if (meeting.zoom_id) { try { await zoom(`/meetings/${meeting.zoom_id}`, token, "DELETE"); } catch (e) { if (!(e instanceof IntegrationError && e.status === 404)) throw e; } }
      joinUrl = null;
      await pool.query("UPDATE integration_meetings SET join_url=NULL,create_state='cancelled' WHERE key=$1", [key]);
    } else if (meeting.create_state === "cancelled") {
      throw new IntegrationError("cancelled_terminal", 409);
    } else if (meeting.zoom_id) {
      await zoom(`/meetings/${meeting.zoom_id}`, token, "PATCH", meetingBody(title, item.starts_at, item.ends_at, marker));
    } else {
      // Commit intent BEFORE contacting Zoom so a process crash cannot cause a second POST.
      await pool.query("UPDATE integration_meetings SET create_state='creating' WHERE key=$1", [key]);
      const created = await zoom(path, token, "POST", meetingBody(title, item.starts_at, item.ends_at, marker));
      const zoomId = String(created.id);
      if (!/^\d+$/.test(zoomId)) throw new IntegrationError("zoom_create_uncertain", 409);
      joinUrl = safeZoomUrl(created.join_url);
      await pool.query("UPDATE integration_meetings SET zoom_id=$2,join_url=$3,create_state='ready',updated_at=now() WHERE key=$1", [key, zoomId, joinUrl]);
    }
    await mark("zoom", null);
  } else if (meeting.zoom_id || meeting.create_state === "creating") { throw new IntegrationError("reconnect_zoom", 409); }

  if (await enabled("calendar")) {
    const token = await googleToken("calendar");
    const eventId = meeting.calendar_id || `sa${digest(`${frontendOrigin()}:${key}`)}`;
    const container = meeting.calendar_container || process.env.GOOGLE_CALENDAR_ID || "primary";
    const path = `/calendars/${encodeURIComponent(container)}/events`;
    if (cancelled) {
      try { await google("calendar", `${path}/${eventId}`, token, "DELETE"); } catch (e) { if (!(e instanceof IntegrationError && [404, 410].includes(e.status))) throw e; }
    } else {
      const body = calendarBody(title, item.starts_at, item.ends_at, meeting.timezone || item.original_timezone || item.timezone, joinUrl);
      try { await google("calendar", `${path}/${eventId}`, token, "PATCH", body); }
      catch (e) {
        if (!(e instanceof IntegrationError && e.status === 404)) throw e;
        try { await google("calendar", path, token, "POST", { id: eventId, ...body }); }
        catch (conflict) { if (!(conflict instanceof IntegrationError && conflict.status === 409)) throw conflict; await google("calendar", `${path}/${eventId}`, token, "PATCH", body); }
      }
    }
    await pool.query("UPDATE integration_meetings SET calendar_id=$2,calendar_container=$3,updated_at=now() WHERE key=$1", [key, eventId, container]);
    await mark("calendar", null);
  } else if (meeting.calendar_id) throw new IntegrationError("reconnect_calendar", 409);
  if (!(await enabled("zoom")) && !(await enabled("calendar"))) throw new IntegrationError("not_configured", 503);
}

export async function classroomSync(enrollmentId: number) {
  const row = (await pool.query(`SELECT l.*,e.status AS enrollment_status,u.email,u.status,u.role FROM integration_classroom_links l JOIN enrollments e ON e.id=l.enrollment_id JOIN users u ON u.id=e.student_id WHERE l.enrollment_id=$1`, [enrollmentId])).rows[0];
  if (!row || row.role !== "student" || row.status !== "active" || row.enrollment_status !== "active") throw new IntegrationError("student_inactive", 403);
  const token = await googleToken("classroom"), course = encodeURIComponent(row.course_id), email = encodeURIComponent(row.email);
  try {
    await google("classroom", `/courses/${course}/students/${email}`, token);
    await pool.query("UPDATE integration_classroom_links SET state='enrolled',error=NULL WHERE enrollment_id=$1", [enrollmentId]);
  } catch (e) {
    if (!(e instanceof IntegrationError && e.status === 404)) throw e;
    let invitation: any;
    try { invitation = await google("classroom", "/invitations", token, "POST", { courseId: row.course_id, userId: row.email, role: "STUDENT" }); }
    catch (conflict) {
      if (!(conflict instanceof IntegrationError && conflict.status === 409)) throw conflict;
      const list = await google("classroom", `/invitations?courseId=${course}&userId=${email}`, token);
      invitation = list.invitations?.[0];
      if (!invitation) throw new IntegrationError("provider_error", 502);
    }
    await pool.query("UPDATE integration_classroom_links SET state='invited',invitation_id=$2,error=NULL WHERE enrollment_id=$1", [enrollmentId, invitation.id]);
  }
  await mark("classroom", null);
}

// Single cross-process advisory lock serializes jobs AND admin integration mutations.
// Session locks survive individual autocommitted writes; crash releases the lock.
export async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT pg_try_advisory_lock(730031) AS locked");
    if (!rows[0].locked) throw new IntegrationError("busy", 409);
    try { return await fn(); } finally { await client.query("SELECT pg_advisory_unlock(730031)"); }
  } finally { client.release(); }
}
export async function tick() {
  await withLock(async () => {
    // A crash may leave running jobs. Global lock proves no other worker owns them.
    await pool.query("UPDATE integration_jobs SET state='pending' WHERE state='running'");
    const job = (await pool.query("SELECT * FROM integration_jobs WHERE state='pending' AND next_at<=now() ORDER BY id LIMIT 1")).rows[0];
    if (!job) return;
    await pool.query("UPDATE integration_jobs SET state='running',attempts=attempts+1,updated_at=now() WHERE id=$1", [job.id]);
    try {
      if (job.kind === "classroom") await classroomSync(job.resource_id);
      else await syncResource(job.kind, job.resource_id);
      await pool.query("UPDATE integration_jobs SET state='succeeded',error=NULL,updated_at=now() WHERE id=$1 AND generation=$2", [job.id, job.generation]);
    } catch (e) {
      const code = e instanceof IntegrationError ? e.code : "internal_error";
      const retry = e instanceof IntegrationError && e.retryable && job.attempts + 1 < 5;
      await pool.query("UPDATE integration_jobs SET state=$2,error=$3,next_at=now()+($4 * interval '1 second'),updated_at=now() WHERE id=$1 AND generation=$5", [job.id, retry ? "pending" : "failed", code, Math.min(900, 30 * 2 ** job.attempts), job.generation]);
      if (job.kind === "classroom") await pool.query("UPDATE integration_classroom_links SET error=$2 WHERE enrollment_id=$1", [job.resource_id, code]);
    }
  });
}
export function startWorker() {
  const timer = setInterval(() => { void tick().catch(e => { if (!(e instanceof IntegrationError && e.code === "busy")) console.error("Integration worker unavailable; check migration/configuration"); }); }, 15_000);
  timer.unref(); return () => clearInterval(timer);
}
export async function driveAccess(assignmentId: number, studentId: number) {
  const row = (await pool.query(`SELECT r.file_id,u.email FROM assigned_materials a JOIN enrollments e ON e.id=a.enrollment_id JOIN users u ON u.id=e.student_id JOIN integration_drive_resources r ON r.material_id=a.material_id WHERE a.id=$1 AND u.id=$2 AND u.status='active' AND e.status='active'`, [assignmentId, studentId])).rows[0];
  if (!row) throw new IntegrationError("resource_missing", 404);
  const inspection = await inspectDrive(row.file_id, await googleToken("drive"));
  if (inspection.public) throw new IntegrationError("drive_public", 409);
  if (!inspection.permissions.some(p => !p.deleted && p.type === "user" && p.emailAddress?.toLowerCase() === row.email.toLowerCase())) throw new IntegrationError("drive_share_required", 403);
  await mark("drive", null);
  return `https://drive.google.com/file/d/${row.file_id}/view`;
}
