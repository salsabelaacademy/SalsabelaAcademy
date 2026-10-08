import {NotificationCenter} from '@/components/NotificationCenter';
import {RecurringLessonForm} from '@/components/RecurringLessonForm';
import { DashboardRecords, AuditEntry } from '@/components/DashboardRecords';
import { programLabel } from '@/lib/program-label';
import { StudentsWorkspace } from '@/components/StudentsWorkspace';
import { AcademySchedule } from '@/components/AcademySchedule';
import { LessonActions, FollowupHistory, useLessonUpdates, deviceSchedule } from '@/components/LessonFollowup';
import { useCourses } from '@/hooks/use-courses';
import { DashboardShell, DashboardOverview } from "@/components/DashboardLayout";
import { BrandLoading, ContentTransition } from "@/components/BrandLoading";
import { useEffect, useState, lazy, Suspense, type FormEvent } from "react";
import { AccountPreferences } from "@/components/AccountPreferences";
const DashboardProfile = lazy(() => import('@/components/DashboardProfile').then(module => ({default: module.DashboardProfile})));
const TestimonialManager = lazy(() => import('@/components/TestimonialManager').then(module => ({default: module.TestimonialManager})));
const AdminArticles = lazy(() => import('./Admin'));
const ArticleEditor = lazy(() => import('./AdminPostEditor'));
const AdminIntegrations = lazy(() => import('./Integrations'));
import { Link, useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth, getDashboardPath } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";

type Field = {
  key: string;
  label?: string;
  type?: string;
  options?: [string, string][];
  value?: string;
  optional?: boolean;
};
async function request(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api" + path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(
      data.code === 'schema_update_required' ? 'schema_update_required' : data.code === 'schedule_conflict'
        ? 'scheduleConflict'
        : r.status === 401
        ? "expired"
        : r.status === 403
          ? "forbidden"
          : r.status === 429
            ? "limited"
            : "failed",
    );
  return data;
}
function ActionForm({
  fields,
  action,
  onDone,
  label = "save",
}: {
  fields: Field[];
  action: (v: any) => Promise<any>;
  onDone: () => void;
  label?: string;
}) {
  const { t } = useTranslation();
  const tr = (k: string) => t((k==='schema_update_required'?'finalPolish.': ['scheduleConflict','invalid'].includes(k) ? 'followup.' : 'p4.') + k);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setMessage("");
    try {
      const result = await action(values);
      setMessage(
        result?.emailDelivery === false ? "emailUnavailable" : "saved",
      );
      onDone();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      {fields.map((f) => (
        <label key={f.key}>
          {tr(f.label || f.key)}
          {f.options ? (
            <select
              aria-label={tr(f.label || f.key)}
              name={f.key}
              required={!f.optional}
              defaultValue={f.value || ""}
            >
              <option value="">{tr("choose")}</option>
              {f.options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              name={f.key}
              defaultValue={f.value}
              required={!f.optional}
              rows={3}
              maxLength={5000}
            />
          ) : (
            <input
              name={f.key}
              type={f.type || "text"}
              defaultValue={f.value}
              required={!f.optional}
              maxLength={5000}
            />
          )}
        </label>
      ))}
      {fields.some((f) => f.type === "datetime-local") && (
        <p>{tr("browserTime")}</p>
      )}
      <button className="p4-button" disabled={busy}>
        {tr(busy ? "sending" : label)}
      </button>
      {message && (
        <p
          role={
            ["saved", "emailUnavailable"].includes(message) ? "status" : "alert"
          }
        >
          {tr(message)}
        </p>
      )}
    </form>
  );
}
const adminDashboardSections = ["overview","applications","students","lessons","attendance","notifications","contactInbox","audit","profile","settings"];
const studentDashboardSections = ["overview","lessons","programs","attendance","notifications","profile","settings"];
const dashboardSections = Array.from(new Set([...adminDashboardSections, ...studentDashboardSections]));
export default function Dashboard() {
  const { t } = useTranslation(),
    { language, setLanguage } = useLanguage(),
    { user, loading, logout } = useAuth();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const {data: courses = []} = useCourses();
  const tr = (k: string) => t((k==='schema_update_required'?'finalPolish.': ['scheduleConflict','invalid'].includes(k) ? 'followup.' : 'p4.') + k);
  const [tab, setTab] = useState(() => {
    if (location.startsWith('/admin')) return location === '/admin/integrations' ? 'integrations' : 'blog';
    const key = new URLSearchParams(window.location.search).get('tab');
    return key && dashboardSections.includes(key) ? key : 'overview';
  }),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [refreshing,setRefreshing]=useState(false),
    [busy, setBusy] = useState(false);
  const reload = () => setRevision((v) => v + 1);
  const {updates, error: updatesError} = useLessonUpdates(revision,Boolean(user));
  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
    else if (user && location !== getDashboardPath(user.role) && !(user.role === 'admin' && location.startsWith('/admin')))
      navigate(getDashboardPath(user.role), { replace: true });
  }, [user, loading, location, navigate]);
  useEffect(() => {
    if (location.startsWith('/admin')) setTab(location === '/admin/integrations' ? 'integrations' : 'blog');
    else if (location.startsWith('/dashboard')) {
      const requested = new URLSearchParams(search).get('tab');
      const permitted = user?.role === "admin" ? adminDashboardSections : studentDashboardSections;
      setTab(requested && permitted.includes(requested) ? requested : 'overview');
    }
  }, [location, search, user?.role]);
  useEffect(() => {
    if (!user) return;
    let live = true, fetching=false;
    const controller=new AbortController();
    const refresh=async(initial=false)=>{if(fetching||document.hidden)return;fetching=true;if(initial)setRefreshing(true);try{const r=await fetch('/api/portal',{credentials:'include',signal:controller.signal});if(!r.ok)throw new Error(r.status===401?'expired':'failed');const d=await r.json();if(live){setData(d);setError('');}}catch(e){if(live&&!(e instanceof Error&&e.name==='AbortError'))setError(e instanceof Error?e.message:'failed');}finally{fetching=false;if(live)setRefreshing(false);}};
    void refresh(true);
    const timer=setInterval(()=>void refresh(),10000);
    const foreground=()=>{if(!document.hidden)void refresh();};
    document.addEventListener('visibilitychange',foreground);
    window.addEventListener('focus',foreground);
    window.addEventListener('academy:data-changed',foreground);
    return ()=>{live=false;controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',foreground);window.removeEventListener('focus',foreground);window.removeEventListener('academy:data-changed',foreground);};
  }, [user, revision]);
  useEffect(()=>{
    const target=new URLSearchParams(search).get('focus');
    if(!target || !/^[a-z]+:[1-9][0-9]*$/.test(target)) return;
    const focus=()=>{
      const card=document.querySelector<HTMLElement>('[data-search-target="'+target+'"]');
      if(!card)return false;
      card.tabIndex=-1;card.focus({preventScroll:true});card.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});return true;
    };
    const observer=new MutationObserver(()=>{if(focus())observer.disconnect();});
    const frame=requestAnimationFrame(()=>{if(!focus())observer.observe(document.getElementById('dashboard-content') || document.body,{subtree:true,childList:true});});
    const timeout=setTimeout(()=>observer.disconnect(),5000);
    return()=>{cancelAnimationFrame(frame);clearTimeout(timeout);observer.disconnect();};
  },[search,tab,data]);
  const admin = user?.role === "admin";
  const tabs = admin ? adminDashboardSections : studentDashboardSections;
  async function act(path: string, method = "PATCH", body?: unknown) {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const d = await request(path, method, body);
      if (d.current) {
        await logout();
        navigate("/login");
        return;
      }
      if(!path.startsWith("/notifications/"))setNotice(d.emailDelivery === false ? "emailUnavailable" : "saved");
      reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }
  const tz = (() => { const value = data?.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone; try { new Intl.DateTimeFormat(language, { timeZone: value }); return value; } catch { return "UTC"; } })();
  const date = (v: string) =>
    v
      ? new Intl.DateTimeFormat(language, {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: tz,
        }).format(new Date(v))
      : tr("noData");
  const status = (s: string) => t("p4.states." + s);
  const person = (id: number) =>
    data?.people?.find((p: any) => p.id === id)?.name || String(id);
  const program = (id: number) => programLabel(data?.programs?.find((p: any) => p.id === id), language, courses);
  const options = (
    list: any[],
    label: (v: any) => string,
  ): [string, string][] => list.map((v) => [String(v.id), label(v)]);
  const localTime = (v: string) => {
    if (!v) return "";
    const d = new Date(v);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  const lessonDates = (v: any) => ({
    ...v,
    ...deviceSchedule(v),
  });
  if (loading || !user)
    return (
      <main className="p4-workspace" role="status">
        <BrandLoading />
      </main>
    );
  return (
    <DashboardShell onRecord={record=>{setNotice('');if(record.kind==='post'){navigate('/admin/edit/'+record.id);return;}setTab(record.tab);navigate(getDashboardPath(user.role)+'?tab='+encodeURIComponent(record.tab)+'&focus='+encodeURIComponent(record.kind+':'+record.id));}} onRefresh={reload} refreshing={refreshing} admin={admin} user={user} tab={tab} tabs={tabs} unread={data?.stats?.unreadNotifications || 0} notifications={data?.notifications || []} notificationDate={date} onRead={(id) => act("/notifications/" + id + "/read", "PATCH")} notificationBusy={busy} notificationError={notice === "failed" ? tr("failed") : ""} onTab={(key) => {setTab(key);setNotice("");navigate(getDashboardPath(user.role)+'?tab='+encodeURIComponent(key));}} onLogout={async () => {
      try { await logout(); navigate("/login"); } catch { setNotice("failed"); }
    }}>
      {notice && (
        <p role="status" className="p4-card">
          {tr(notice)}
        </p>
      )}
      {error && data && <p role="alert" className="p4-card">{t("review.refreshFailed")}</p>}
      {error && !data ? (
        <div role="alert" className="p4-card">
          <p>{tr(error)}</p>
          <button className="p4-button" onClick={reload}>
            {tr("retry")}
          </button>
        </div>
      ) : !data ? (
        <BrandLoading compact />
      ) : (
        <ContentTransition identity={location+':'+tab+':'+language}><Suspense fallback={<BrandLoading compact />}><div className={"p4-stack dash-section dash-section-"+tab}>
          {admin && tab === 'blog' && <div className={location === '/admin' ? 'dash-embedded dash-blog' : 'dash-embedded dash-editor'} data-no-reveal>{location === '/admin' ? <AdminArticles /> : <ArticleEditor key={location} />}</div>}
          {admin && tab === 'integrations' && <div className="dash-embedded dash-integrations" data-no-reveal><AdminIntegrations /></div>}
          {tab === "overview" && <DashboardOverview admin={admin} user={user} data={data} timezone={tz} refreshKey={revision} onTab={key=>{setTab(key);navigate(getDashboardPath(user.role)+'?tab='+encodeURIComponent(key));}} />}
          {tab === "profile" && <DashboardProfile onSaved={reload} />}
          {tab === "applications" && admin && (
            <>
              <div className="dash-page-heading"><h2>{tr("applications")}</h2><p>{t('refinement.applicationsHint')}</p></div>
              <DashboardRecords items={data.applications} searchText={a=>[a.name,a.email,a.learning_goals,a.current_experience].join(' ')} status={a=>a.status} focusKind="application">{(a: any) => (
                <article data-search-target={"application:"+a.id} key={a.id} className="p4-card p4-stack">
                  <h3>{a.name}</h3>
                  <p dir="ltr">{a.email}</p>
                  <span className="p4-badge">{status(a.status)}</span>
                  <p>{a.learning_goals}</p>
                  <p>{a.current_experience}</p>
                  {(a.availability||a.timezone)&&<p>{[a.availability,a.timezone].filter(Boolean).join(' · ')}</p>}
                  <details className="dash-record-details"><summary>{t("refinement.details")}</summary><ActionForm
                    onDone={reload}
                    action={(v) =>
                      request("/admin/applications/" + a.id, "PATCH", v)
                    }
                    fields={[
                      {
                        key: "status",
                        value: a.status,
                        options: [
                          "new",
                          "contacted",
                          "assessment_booked",
                          "assessed",
                          "accepted",
                          "rejected",
                          "archived",
                        ].map((k) => [k, status(k)]),
                      },
                    ]}
                  />
                  <ActionForm
                    onDone={reload}
                    action={(v) =>
                      request(`/portal/applications/${a.id}/notes`, "PATCH", v)
                    }
                    fields={[
                      {
                        key: "notes",
                        type: "textarea",
                        value: a.admin_notes || "",
                        optional: true,
                      },
                    ]}
                  />
                  {a.status === "accepted" && (
                    <button
                      disabled={busy}
                      className="p4-button"
                      onClick={() =>
                        act("/admin/applications/" + a.id, "PATCH", {
                          status: "accepted",
                          action: "invite",
                        })
                      }
                    >
                      {tr("invite")}
                    </button>
                  )}
                  <details>
                    <summary className="p4-control">{tr("schedule")}</summary>
                    <ActionForm
                      onDone={reload}
                      label="schedule"
                      fields={[
                        {
                          key: "startsAt",
                          label: "start",
                          type: "datetime-local",
                        },
                        { key: "endsAt", label: "end", type: "datetime-local" },
                      ]}
                      action={(v) =>
                        request("/admin/applications/" + a.id, "PATCH", {
                          ...lessonDates(v),
                          originalTimezone:
                            Intl.DateTimeFormat().resolvedOptions().timeZone,
                          status: a.status,
                          action: "schedule",
                        })
                      }
                    />
                  </details></details>
                </article>
              )}</DashboardRecords>              {!data.applications.length && <p>{tr("empty")}</p>}
            </>
          )}
          {tab === "students" && admin && (
            <>
              <StudentsWorkspace data={data} date={date} program={program} onDone={reload} busy={busy} updates={updates} updatesError={updatesError} onStatus={p=>act('/admin/users/'+p.id+'/status','PATCH',{status:p.status==='active'?'suspended':'active'})}/>
              <section className="p4-card">
                <h3>{tr("enroll")}</h3>
                <ActionForm
                  onDone={reload}
                  action={(v) => request("/admin/enrollments", "POST", v)}
                  label="enroll"
                  fields={[
                    {
                      key: "studentId",
                      label: "student",
                      options: options(
                        data.people.filter((p: any) => p.status === "active"),
                        (p) => p.name,
                      ),
                    },
                    {
                      key: "programId",
                      label: "program",
                      options: options(data.programs, (p) => program(p.id)),
                    },
                  ]}
                />
              </section>
            </>
          )}
          {tab === "lessons" && (
            <>
              <h2>{tr("lessons")}</h2>
              <AcademySchedule lessons={data.lessons} appointments={data.appointments || []} timezone={tz} people={data.people} admin={admin} renderCreate={() => (
<section className="p4-card">
                  <h3>{t("dashboardUpdate.single")}</h3>
                  <ActionForm
                    label="create"
                    onDone={reload}
                    fields={[
                      {
                        key: "studentId",
                        label: "student",
                        options: options(
                          data.people.filter((p: any) => p.status === "active"),
                          (p) => p.name,
                        ),
                      },
                      { key: "title" },
                      {
                        key: "startsAt",
                        label: "start",
                        type: "datetime-local",
                      },
                      { key: "endsAt", label: "end", type: "datetime-local" },
                    ]}
                    action={(v) =>
                      request("/admin/lessons", "POST", lessonDates(v))
                    }
                  />
                  <RecurringLessonForm people={data.people} timezone={tz} onDone={reload}/>
                  <Link className="p4-text-link" href="/admin/integrations">
                    {tr("linked")}
                  </Link>
                </section>
              )} renderAppointment={a=><section className="p4-card p4-stack"><h3>{date(a.starts_at)}</h3><span className="p4-badge">{status(a.status)}</span>{admin&&<><p>{a.student_id?person(a.student_id):data.applications.find((v:any)=>v.id===a.application_id)?.name}</p>{!['cancelled','completed'].includes(a.status)&&<ActionForm onDone={reload} fields={[{key:'startsAt',label:'start',type:'datetime-local',value:localTime(a.starts_at)},{key:'endsAt',label:'end',type:'datetime-local',value:localTime(a.ends_at)}]} action={v=>request('/admin/appointments/'+a.id,'PATCH',lessonDates(v))}/>}<div className="p4-row">{!['cancelled','completed'].includes(a.status)&&<><button className="p4-button" disabled={busy} onClick={()=>act('/admin/appointments/'+a.id,'PATCH',{status:'completed'})}>{tr('complete')}</button><button className="p4-button" disabled={busy} onClick={()=>act('/admin/appointments/'+a.id,'PATCH',{status:'cancelled'})}>{tr('cancel')}</button></>}</div></>}</section>} renderLesson={(l: any) => (
                <article className="p4-card p4-stack" data-search-target={"lesson:"+l.id} key={l.id}>
                  <h3>{l.title}</h3>
                  <p>
                    {admin ? person(l.student_id) : ""} · {date(l.starts_at)} ·{" "}
                    {tz}
                  </p>
                  <span className="p4-badge">{status(l.status)}</span>
                  {admin ? (
                    <>
                      <LessonActions lesson={l} onDone={reload}/>
                      <ActionForm
                        onDone={reload}
                        label="editLesson"
                        fields={[
                          {
                            key: "feedback",
                            type: "textarea",
                            value: l.feedback || "",
                            optional: true,
                          },
                          {
                            key: "privateNotes",
                            type: "textarea",
                            value: l.private_admin_notes || "",
                            optional: true,
                          },
                          {
                            key: "attendance",
                            optional: true,
                            value: l.attendance || "",
                            options: [
                              "present",
                              "late",
                              "absent",
                              "excused",
                            ].map((k) => [k, status(k)]),
                          },
                        ]}
                        action={(v) => {
                          if (!v.attendance) delete v.attendance;
                          return request(
                            `/portal/lessons/${l.id}/details`,
                            "PATCH",
                            v,
                          );
                        }}
                      />
                      {l.status !== "cancelled" && (
                        <>
                          <div className="p4-row">
                            {l.status === "scheduled" && (
                              <button
                                className="p4-button"
                                disabled={busy}
                                onClick={() =>
                                  act("/admin/lessons/" + l.id, "PATCH", {
                                    status: "completed",
                                  })
                                }
                              >
                                {tr("complete")}
                              </button>
                            )}
                            <button
                              className="p4-button"
                              disabled={busy}
                              onClick={() =>
                                act("/admin/lessons/" + l.id, "PATCH", {
                                  status: "cancelled",
                                })
                              }
                            >
                              {tr("cancel")}
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {l.feedback && (
                        <p>
                          {tr("feedback")}: {l.feedback}
                        </p>
                      )}
                    </>
                  )}
                  <FollowupHistory updates={updates} error={updatesError} lessonId={l.id}/>
                </article>
              )}/>
              {!data.lessons.length && <p>{tr("empty")}</p>}
            </>
          )}
          {tab === "programs" && (
            <>
              <h2>{tr("programs")}</h2>
              {data.enrollments.map((e: any) => (
                <article className="p4-card" data-search-target={"enrollment:"+e.id} key={e.id}>
                  <h3>{program(e.program_id)}</h3>
                  <p>{status(e.status)}</p>
                </article>
              ))}
              {!data.enrollments.length && <p>{tr("empty")}</p>}
            </>
          )}
          {tab === "attendance" && (
            <>
              <div className="dash-page-heading"><h2>{tr("attendance")}</h2><p>{t('refinement.attendanceHint')}</p></div>
              <DashboardRecords items={data.attendance} searchText={a=>[person(a.student_id),date(a.session_date),status(a.status)].join(' ')} status={a=>a.status} focusKind="attendance">{(a: any) => (
                <article className="p4-card" data-search-target={"attendance:"+a.id} key={a.id}>
                  <h3>{admin ? person(a.student_id) : tr("attendance")}</h3>
                  <p>{date(a.session_date)}</p>
                  <span className="p4-badge">{status(a.status)}</span>
                </article>
              )}</DashboardRecords>              {!data.attendance.length && <p>{tr("empty")}</p>}
            </>
          )}

          {tab === "notifications" && <NotificationCenter items={data.notifications} date={date} onDone={reload}/>}
          {tab === "contactInbox" && admin && (
            <>
              <div className="dash-page-heading"><h2>{tr("contactInbox")}</h2><p>{t('refinement.contactHint')}</p></div>
              <DashboardRecords items={data.contacts} searchText={c=>[c.subject,c.message,c.name,c.email].join(' ')} focusKind="contact">{(c: any) => (
                <article className="p4-card" data-search-target={"contact:"+c.id} key={c.id}>
                  <h3>{c.subject}</h3>
                  <p>
                    {c.name} · {c.email}
                  </p>
                  <p className="whitespace-pre-wrap">{c.message}</p>
                  <p>{date(c.created_at)}</p><a className="p4-text-link" href={"mailto:"+encodeURIComponent(c.email)}>{t("refinement.respond")}</a>
                </article>
              )}</DashboardRecords>              {!data.contacts.length && <p>{tr("empty")}</p>}
            </>
          )}
          {tab === "audit" && admin && (
            <>
              <div className="dash-page-heading"><h2>{tr("audit")}</h2><p>{t('refinement.auditHint')}</p></div>
              <DashboardRecords items={data.audit} searchText={a=>[a.name,a.action,a.resource,date(a.created_at)].join(' ')} focusKind="audit">{a=><AuditEntry key={a.id} entry={a} date={date}/>}</DashboardRecords>
              {!data.audit.length && <p>{tr("empty")}</p>}
            </>
          )}
          {tab === "settings" && (
            <>
              <div className="dash-page-heading"><h2>{tr("settings")}</h2><p>{t('refinement.settingsHint')}</p></div><AccountPreferences />
              {admin && <details className="settings-details"><summary>{t("homeContent.manage")}</summary><TestimonialManager /></details>}
              <section className="p4-card">
                {admin ? (
                  <>
                    <p>{tr("settingsHint")}</p>
                    <ActionForm
                      onDone={reload}
                      action={(v) => request("/portal/settings", "PATCH", v)}
                      fields={[
                        {
                          key: "publicName",
                          value: data.settings?.public_name,
                        },
                        {
                          key: "contactEmail",
                          type: "email",
                          optional: true,
                          value: data.settings?.contact_email,
                        },
                      ]}
                    />
                  </>
                ) : (
                  <button className="p4-button" onClick={() => setTab("profile")}>{tr("profile")}</button>
                )}
              </section>
              <section className="dash-panel settings-security"><h2>{tr("accountSecurity")}</h2><Link className="p4-text-link" href="/account/password">
                {tr("password")}
              </Link>
              </section>
            </>
          )}
        </div></Suspense></ContentTransition>
      )}
    </DashboardShell>
  );
}
