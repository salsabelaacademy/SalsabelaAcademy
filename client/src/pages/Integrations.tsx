import { programLabel } from '@/lib/program-label';
import { useCourses } from '@/hooks/use-courses';
import { api, Panel, type Row } from "@/components/integration-shared";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth, getDashboardPath } from "@/hooks/use-auth";
import { DisplayControls } from "@/components/PublicShell";
import { BrandLoading } from '@/components/BrandLoading';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-2 text-sm font-medium">{label}{children}</label>; }
const selectClass = "min-h-11 w-full rounded-md border bg-background p-2 text-foreground";
const localDate = (s?: string | null) => { if (!s) return ""; const d = new Date(s); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export default function Integrations() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  const {data: publicCourses = []} = useCourses();
  const tr = (key: string) => t(`integrations.${key}`);
  const [connections, setConnections] = useState<Row[]>([]), [jobs, setJobs] = useState<Row[]>([]), [sessions, setSessions] = useState<Row[]>([]);
  const [notification, setNotification] = useState<{ configured: boolean; sender: string | null; domain: string } | null>(null);
  const [students, setStudents] = useState<Row[]>([]), [enrollments, setEnrollments] = useState<Row[]>([]), [catalog, setCatalog] = useState<Row>({ programs: [], units: [], materials: [] });
  const [courses, setCourses] = useState<Row[]>([]), [nextPage, setNextPage] = useState<string | null>(null), [links, setLinks] = useState<Row[]>([]);
  const [notice, setNotice] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [lesson, setLesson] = useState({ studentId: "", programId: "", title: "", startsAt: "", endsAt: "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const [edit, setEdit] = useState<Row | null>(null), [recovery, setRecovery] = useState<Row | null>(null), [zoomId, setZoomId] = useState("");
  const [link, setLink] = useState({ enrollmentId: "", courseId: "" });
  const [initializing, setInitializing] = useState(true);
  const date = (s?: string) => s ? new Date(s).toLocaleString(i18n.language) : tr("never");
  const errorText = (code: string) => t(`integrations.errors.${code}`, { defaultValue: tr("errors.internal_error") });
  async function reload() {
    const [c, j, s, d, e, l, mail] = await Promise.all([api("/admin/integrations"), api("/admin/integrations/jobs"), api("/admin/integrations/sessions"), api("/dashboard/admin"), api("/enrollments"), api("/admin/integrations/classroom/links"), api("/admin/notifications/status")]);
    const {programs}=await api("/portal");
    setNotification(mail);
    setConnections(c.filter((v:Row)=>v.provider!=='drive')); setJobs(j); setSessions(s); setStudents(d.users?.filter((u: Row) => u.role === "student") || []); setEnrollments(e); setCatalog({programs,units:[],materials:[]}); setLinks(l);
  }
  useEffect(() => { if (!loading && user?.role !== "admin") navigate(user ? getDashboardPath(user.role) : "/login"); }, [loading, user, navigate]);
  useEffect(() => {
    if (user?.role !== "admin") return;
    void reload().catch(e => setError(e.message)).finally(() => setInitializing(false));
    if (new URLSearchParams(window.location.search).get("oauth") === "error") setNotice("oauthError");
    const timer = setInterval(() => { if(document.hidden)return;void Promise.all([api("/admin/integrations/jobs"), api("/admin/integrations")]).then(([j, c]) => { setJobs(j); setConnections(c.filter((v:Row)=>v.provider!=='drive')); }).catch(() => {}); }, 15000);
    return () => clearInterval(timer);
  }, [user]);
  async function run(fn: () => Promise<any>, queued = false) {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); setNotice(queued ? "queued" : "success"); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "internal_error"); } finally { setBusy(false); }
  }
  if (loading || user?.role !== "admin" || initializing) return <BrandLoading compact />;
  const programName = (p?: Row) => programLabel(p as {name: string; slug: string} | undefined, i18n.language, publicCourses);
  const enrollmentOptions = enrollments.filter(e => e.status === "active").map(e => <option key={e.id} value={e.id}>#{e.id} — {students.find(s => s.id === e.studentId)?.name || e.studentId} — {programName(catalog.programs.find((p: Row) => p.id === e.programId))}</option>);
  return <section className="academy-admin-page academy-integration-page min-h-screen bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:p-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4"><Link href="/dashboard/admin" className="underline">{tr("back")}</Link><DisplayControls /><Button disabled={busy} onClick={() => run(reload)}>{tr("refresh")}</Button></header>
      <div><h1 className="text-3xl font-bold">{tr("title")}</h1><p className="mt-2 text-slate-600 dark:text-slate-300">{tr("subtitle")}</p></div>
      {error && <p role="alert" className="rounded-lg border border-red-400 p-4 text-red-700 dark:text-red-300">{errorText(error)}</p>}
      {notice && <p role="status" className="rounded-lg bg-blue-50 p-4 text-blue-950 dark:bg-blue-950 dark:text-blue-100">{tr(notice)}</p>}
      <div className="grid gap-4 md:grid-cols-2">{connections.map(c => <Panel key={c.provider} title={tr(c.provider)}>
        <p className="font-semibold">{tr(c.status)}</p><p className="text-sm">{tr("lastSuccess")}: {date(c.lastSuccess)}</p>
        {!c.configured && <p className="text-sm">{tr("missing")}</p>}{c.error && <p role="alert" className="text-sm">{errorText(c.error)}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy || !c.configured} onClick={() => run(async () => { const r = await api(`/admin/integrations/${c.provider}/connect`, "POST"); if (r.url) window.location.assign(r.url); })}>{tr(c.enabled ? "reconnect" : "connect")}</Button>
          <Button variant="outline" disabled={busy || !c.configured || !c.enabled} onClick={() => run(() => api(`/admin/integrations/${c.provider}/test`, "POST"))}>{tr("test")}</Button>
          <Button variant="outline" disabled={busy || !c.enabled} onClick={() => { if (window.confirm(tr("confirmDisconnect") + (c.provider !== "zoom" ? `\n${tr("googleWarning")}` : ""))) void run(() => api(`/admin/integrations/${c.provider}/disconnect`, "POST")); }}>{tr("disconnect")}</Button>
        </div>
      </Panel>)}</div>
      <Panel title={tr("notificationTitle")}>
        <p>{notification?.configured ? tr("configured") : tr("not_configured")}</p>
        <p className="text-sm">{tr("notificationDomain")}: {notification?.domain || "notifications.salsabela.com"}</p>
        {notification?.sender && <p className="text-sm">{tr("notificationSender")}: {notification.sender}</p>}
        <p className="text-sm">{tr("notificationNote")}</p>
        <Button disabled={busy || !notification?.configured} onClick={() => run(() => api("/admin/notifications/test", "POST"))}>{tr("notificationTest")}</Button>
      </Panel>
      <Panel title={tr("createLesson")}><form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void run(() => api("/admin/lessons", "POST", { ...lesson, programId: lesson.programId || undefined, startsAt: new Date(lesson.startsAt).toISOString(), endsAt: new Date(lesson.endsAt).toISOString() }), true); }}>
        <Field label={tr("student")}><select required className={selectClass} value={lesson.studentId} onChange={e => setLesson({ ...lesson, studentId: e.target.value })}><option value="">{tr("choose")}</option>{students.filter(s => s.status === "active").map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label={tr("program")}><select className={selectClass} value={lesson.programId} onChange={e => setLesson({ ...lesson, programId: e.target.value })}><option value="">{tr("choose")}</option>{catalog.programs.map((p: Row) => <option key={p.id} value={p.id}>{programName(p)}</option>)}</select></Field>
        <Field label={tr("titleLabel")}><Input required maxLength={150} value={lesson.title} onChange={e => setLesson({ ...lesson, title: e.target.value })} /></Field>
        <Field label={tr("timezone")}><Input required value={lesson.timezone} onChange={e => setLesson({ ...lesson, timezone: e.target.value })} /></Field>
        <Field label={tr("start")}><Input type="datetime-local" required value={lesson.startsAt} onChange={e => setLesson({ ...lesson, startsAt: e.target.value })} /></Field>
        <Field label={tr("end")}><Input type="datetime-local" required value={lesson.endsAt} onChange={e => setLesson({ ...lesson, endsAt: e.target.value })} /></Field>
        <p className="text-sm sm:col-span-2">{tr("localTime")}</p><Button disabled={busy}>{tr("createLesson")}</Button>
      </form></Panel>
      <Panel title={tr("lessons")}>
        {!sessions.length && <p>{tr("empty")}</p>}{sessions.map(s => <article key={`${s.kind}:${s.id}`} className="space-y-3 border-b py-4 last:border-0">
          <h3 className="font-semibold">{s.title} <span className="text-sm">— {tr(s.kind)} #{s.id}</span></h3><p>{date(s.starts_at)} — {date(s.ends_at)} · {tr(s.status)}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => run(() => api(`/admin/integrations/sync/${s.kind}/${s.id}`, "POST"), true)}>{tr("sync")}</Button>
            {["scheduled", "confirmed", "requested"].includes(s.status) && <>
              <Button variant="outline" disabled={busy} onClick={() => setEdit({ ...s, startsAt: localDate(s.starts_at), endsAt: localDate(s.ends_at) })}>{tr("reschedule")}</Button>
              {s.status === "requested" && <Button disabled={busy} onClick={() => run(() => api(`/admin/${s.kind}s/${s.id}`, "PATCH", { status: "confirmed" }), true)}>{tr("confirm")}</Button>}
              <Button variant="outline" disabled={busy} onClick={() => run(async () => { const r = await api(`/admin/integrations/host/${s.kind}/${s.id}`, "POST"); window.location.assign(r.url); })}>{tr("host")}</Button>
              <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm(tr("confirmCancel"))) void run(() => api(`/admin/${s.kind}s/${s.id}`, "PATCH", { status: "cancelled" }), true); }}>{tr("cancel")}</Button>
            </>}
          </div>
        </article>)}
        {edit && <form className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void run(async () => { await api(`/admin/${edit.kind}s/${edit.id}`, "PATCH", { startsAt: new Date(edit.startsAt).toISOString(), endsAt: new Date(edit.endsAt).toISOString() }); setEdit(null); }, true); }}><Field label={tr("start")}><Input required type="datetime-local" value={edit.startsAt} onChange={e => setEdit({ ...edit, startsAt: e.target.value })} /></Field><Field label={tr("end")}><Input required type="datetime-local" value={edit.endsAt} onChange={e => setEdit({ ...edit, endsAt: e.target.value })} /></Field><p>{tr("localTime")}</p><Button disabled={busy}>{tr("save")}</Button></form>}
      </Panel>
      <Panel title={tr("jobs")}>{!jobs.length && <p>{tr("empty")}</p>}{jobs.map(j => <div key={j.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3">
        <div><p>#{j.id} · {tr(j.kind)} #{j.resource_id} · {tr(j.state)} · {tr("attempts")}: {j.attempts}</p>{j.error && <p className="mt-1 text-sm">{errorText(j.error)}</p>}</div>
        {j.state === "failed" && <Button variant="outline" disabled={busy} onClick={() => run(() => api(`/admin/integrations/jobs/${j.id}/retry`, "POST"), true)}>{tr("retry")}</Button>}
        {j.error === "zoom_create_uncertain" && <Button variant="outline" onClick={() => setRecovery(j)}>{tr("recover")}</Button>}
      </div>)}
      {recovery && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => { await api(`/admin/integrations/recover/${recovery.kind}/${recovery.resource_id}`, "POST", { zoomId }); setRecovery(null); }, true); }}><p>{tr("recoverNote")}</p><Field label={tr("zoomId")}><Input required pattern="[0-9]{9,12}" value={zoomId} onChange={e => setZoomId(e.target.value)} /></Field><Button disabled={busy}>{tr("recover")}</Button></form>}
      </Panel>
      <Panel title={tr("classroom")}><p className="text-sm">{tr("classroomNote")}</p>
        <Button disabled={busy} onClick={() => run(async () => { const r = await api("/admin/integrations/classroom/courses"); setCourses(r.courses); setNextPage(r.nextPageToken); })}>{tr("courses")}</Button>
        {nextPage && <Button disabled={busy} onClick={() => run(async () => { const r = await api(`/admin/integrations/classroom/courses?pageToken=${encodeURIComponent(nextPage)}`); setCourses([...courses, ...r.courses]); setNextPage(r.nextPageToken); })}>{tr("more")}</Button>}
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void run(() => api("/admin/integrations/classroom/link", "POST", link), true); }}>
          <Field label={tr("enrollment")}><select required className={selectClass} value={link.enrollmentId} onChange={e => setLink({ ...link, enrollmentId: e.target.value })}><option value="">{tr("choose")}</option>{enrollmentOptions}</select></Field>
          <Field label={tr("course")}><select required className={selectClass} value={link.courseId} onChange={e => setLink({ ...link, courseId: e.target.value })}><option value="">{tr("choose")}</option>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Button disabled={busy}>{tr("link")}</Button>
        </form><h3 className="font-semibold">{tr("links")}</h3>{!links.length && <p>{tr("empty")}</p>}{links.map(l => <p key={l.enrollment_id}>#{l.enrollment_id} → {l.course_id} · {tr(l.state)} {l.error && errorText(l.error)}</p>)}
      </Panel>
    </div>
  </section>;
}
