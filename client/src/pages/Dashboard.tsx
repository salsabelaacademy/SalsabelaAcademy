import { programLabel } from '@/lib/program-label';
import { useCourses } from '@/hooks/use-courses';
import { DashboardShell, DashboardOverview } from "@/components/DashboardLayout";
import { BrandLoading, ContentTransition } from "@/components/BrandLoading";
import { useEffect, useState, lazy, Suspense, type FormEvent } from "react";
const DashboardProfile = lazy(() => import('@/components/DashboardProfile').then(module => ({default: module.DashboardProfile})));
const TestimonialManager = lazy(() => import('@/components/TestimonialManager').then(module => ({default: module.TestimonialManager})));
const AdminArticles = lazy(() => import('./Admin'));
const ArticleEditor = lazy(() => import('./AdminPostEditor'));
const AdminIntegrations = lazy(() => import('./Integrations'));
import { Link, useLocation, useSearch } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth, getDashboardPath } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { StudentLiveResources } from "@/components/StudentLiveResources";
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
      r.status === 401
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
  const tr = (k: string) => t("p4." + k);
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
const adminDashboardSections = ["overview","applications","students","lessons","attendance","messages","notifications","contactInbox","audit","profile","settings"];
const studentDashboardSections = ["overview","lessons","programs","homework","attendance","messages","notifications","profile","settings"];
const dashboardSections = Array.from(new Set([...adminDashboardSections, ...studentDashboardSections]));
export default function Dashboard() {
  const { t } = useTranslation(),
    { language, setLanguage } = useLanguage(),
    { user, loading, logout, logoutAll } = useAuth();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const {data: courses = []} = useCourses();
  const tr = (k: string) => t("p4." + k);
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
    let live = true;
    setRefreshing(true);
    request("/portal")
      .then((d) => {
        if (live) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      }).finally(()=>{if(live)setRefreshing(false);});
    return () => {
      live = false;
    };
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
      setNotice(d.emailDelivery === false ? "emailUnavailable" : "saved");
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
    startsAt: new Date(v.startsAt).toISOString(),
    endsAt: new Date(v.endsAt).toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
        <ContentTransition identity={location+':'+tab+':'+language}><Suspense fallback={<BrandLoading compact />}><div className="p4-stack">
          {admin && tab === 'blog' && <div className={location === '/admin' ? 'dash-embedded dash-blog' : 'dash-embedded dash-editor'} data-no-reveal>{location === '/admin' ? <AdminArticles /> : <ArticleEditor key={location} />}</div>}
          {admin && tab === 'integrations' && <div className="dash-embedded dash-integrations" data-no-reveal><AdminIntegrations /></div>}
          {tab === "overview" && <DashboardOverview admin={admin} user={user} data={data} timezone={tz} refreshKey={revision} onTab={key=>{setTab(key);navigate(getDashboardPath(user.role)+'?tab='+encodeURIComponent(key));}} />}
          {tab === "profile" && <DashboardProfile onSaved={reload} />}
          {tab === "applications" && admin && (
            <>
              <h2>{tr("applications")}</h2>
              {data.applications.map((a: any) => (
                <article data-search-target={"application:"+a.id} key={a.id} className="p4-card p4-stack">
                  <h3>{a.name}</h3>
                  <p dir="ltr">{a.email}</p>
                  <span>{status(a.status)}</span>
                  <p>{a.learning_goals}</p>
                  <p>{a.current_experience}</p>
                  <p>
                    {a.availability} · {a.timezone}
                  </p>
                  <ActionForm
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
                  </details>
                </article>
              ))}
              {!data.applications.length && <p>{tr("empty")}</p>}
            </>
          )}
          {tab === "students" && admin && (
            <>
              <h2>{tr("students")}</h2>
              {data.people.map((p: any) => (
                <article className="p4-card" data-search-target={"student:"+p.id} key={p.id}>
                  <h3>{p.name}</h3>
                  <p>{p.email}</p>
                  <p>{status(p.status)}</p>
                  {["active", "suspended"].includes(p.status) && (
                    <button
                      className="p4-button"
                      disabled={busy}
                      onClick={() =>
                        act("/admin/users/" + p.id + "/status", "PATCH", {
                          status:
                            p.status === "active" ? "suspended" : "active",
                        })
                      }
                    >
                      {tr(p.status === "active" ? "suspend" : "activate")}
                    </button>
                  )}
                </article>
              ))}
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
              {admin && (
                <section className="p4-card">
                  <h3>{tr("create")}</h3>
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
                  <Link className="p4-text-link" href="/admin/integrations">
                    {tr("linked")}
                  </Link>
                </section>
              )}
              {!admin && <StudentLiveResources timezone={tz} refreshKey={revision} />}
              {data.lessons.map((l: any) => (
                <article className="p4-card p4-stack" data-search-target={"lesson:"+l.id} key={l.id}>
                  <h3>{l.title}</h3>
                  <p>
                    {admin ? person(l.student_id) : ""} · {date(l.starts_at)} ·{" "}
                    {tz}
                  </p>
                  <span className="p4-badge">{status(l.status)}</span>
                  {admin ? (
                    <>
                      <ActionForm
                        onDone={reload}
                        label="editLesson"
                        fields={[
                          {
                            key: "homework",
                            type: "textarea",
                            value: l.homework || "",
                            optional: true,
                          },
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
                          <ActionForm
                            onDone={reload}
                            fields={[
                              {
                                key: "startsAt",
                                label: "start",
                                type: "datetime-local",
                                value: localTime(l.starts_at),
                              },
                              {
                                key: "endsAt",
                                label: "end",
                                type: "datetime-local",
                                value: localTime(l.ends_at),
                              },
                            ]}
                            action={(v) =>
                              request(
                                "/admin/lessons/" + l.id,
                                "PATCH",
                                lessonDates(v),
                              )
                            }
                          />
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
                      {l.homework && (
                        <p>
                          {tr("homework")}: {l.homework}
                        </p>
                      )}
                      {l.feedback && (
                        <p>
                          {tr("feedback")}: {l.feedback}
                        </p>
                      )}
                    </>
                  )}
                </article>
              ))}
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
          {tab === "curriculum" && (
            <>
              <h2>{tr("curriculum")}</h2>
              {admin && (
                <>
                  <div className="p4-grid">
                    <section className="p4-card">
                      <h3>{tr("newModule")}</h3>
                      <ActionForm
                        label="create"
                        onDone={reload}
                        action={(v) => request("/portal/modules", "POST", v)}
                        fields={[
                          {
                            key: "programId",
                            label: "program",
                            options: options(data.programs, (p) =>
                              program(p.id),
                            ),
                          },
                          { key: "title" },
                        ]}
                      />
                    </section>
                    <section className="p4-card">
                      <h3>{tr("newUnit")}</h3>
                      <ActionForm
                        label="create"
                        onDone={reload}
                        action={(v) => request("/portal/units", "POST", v)}
                        fields={[
                          {
                            key: "moduleId",
                            label: "module",
                            options: options(data.modules, (m) => m.title),
                          },
                          { key: "title" },
                          { key: "body", type: "textarea" },
                        ]}
                      />
                    </section>
                    <section className="p4-card">
                      <h3>{tr("assign")}</h3>
                      <ActionForm
                        label="assign"
                        onDone={reload}
                        action={(v) => request("/portal/assign", "POST", v)}
                        fields={[
                          {
                            key: "enrollmentId",
                            label: "enrollment",
                            options: options(
                              data.enrollments.filter(
                                (e: any) => e.status === "active",
                              ),
                              (e) =>
                                person(e.student_id) +
                                " · " +
                                program(e.program_id),
                            ),
                          },
                          {
                            key: "unitId",
                            label: "unit",
                            options: options(data.units, (u) => u.title),
                          },
                        ]}
                      />
                    </section>
                  </div>
                  <Link className="p4-text-link" href="/admin/integrations">
                    {tr("linked")}
                  </Link>
                </>
              )}
              {data.units.map((u: any) => (
                <article className="p4-card" key={u.id}>
                  <h3>{u.title}</h3>
                  <p className="whitespace-pre-wrap">{u.body}</p>
                  {u.completion_status && (
                    <span>{status(u.completion_status)}</span>
                  )}
                </article>
              ))}
              {admin &&
                data.progress.map((p: any) => (
                  <article className="p4-card" key={p.id}>
                    <h3>
                      {data.units.find((u: any) => u.id === p.unit_id)?.title}
                    </h3>
                    <p>
                      {person(
                        data.enrollments.find(
                          (e: any) => e.id === p.enrollment_id,
                        )?.student_id,
                      )}
                    </p>
                    <ActionForm
                      onDone={reload}
                      action={(v) =>
                        request("/admin/progress/" + p.id, "PATCH", v)
                      }
                      fields={[
                        {
                          key: "completionStatus",
                          label: "progress",
                          value: p.completion_status,
                          options: [
                            "not_started",
                            "in_progress",
                            "completed",
                          ].map((k) => [k, status(k)]),
                        },
                      ]}
                    />
                  </article>
                ))}
              {!data.units.length && <p>{tr("empty")}</p>}
              {!admin && (
                <>
                  {data.materials.map((m: any) => (
                    <article className="p4-card" key={m.id}>
                      <h3>{m.title}</h3>
                      <button
                        className="p4-button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const d = await request(
                              "/portal/materials/" + m.id + "/open",
                            );
                            window.open(d.url, "_blank", "noopener,noreferrer");
                          } catch (e) {
                            setNotice("failed");
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {t("integrations.open")}
                      </button>
                    </article>
                  ))}
                  <StudentLiveResources timezone={tz} refreshKey={revision} />
                </>
              )}
            </>
          )}
          {tab === "homework" && (
            <>
              <h2>{tr("homework")}</h2>
              {data.lessons
                .filter((l: any) => l.homework || l.feedback)
                .map((l: any) => (
                  <article className="p4-card" data-search-target={"homework:"+l.id} key={l.id}>
                    <h3>{l.title}</h3>
                    <p>{l.homework}</p>
                    <p>{l.feedback}</p>
                  </article>
                ))}
              {!data.lessons.some((l: any) => l.homework || l.feedback) && (
                <p>{tr("empty")}</p>
              )}
            </>
          )}
          {tab === "attendance" && (
            <>
              <h2>{tr("attendance")}</h2>
              {data.attendance.map((a: any) => (
                <article className="p4-card" data-search-target={"attendance:"+a.id} key={a.id}>
                  <h3>{admin ? person(a.student_id) : tr("attendance")}</h3>
                  <p>{date(a.session_date)}</p>
                  <span className="p4-badge">{status(a.status)}</span>
                </article>
              ))}
              {!data.attendance.length && <p>{tr("empty")}</p>}
            </>
          )}
          {tab === "messages" && (
            <>
              <h2>{tr("messages")}</h2>
              <section className="p4-card">
                <ActionForm
                  label="send"
                  onDone={reload}
                  action={(v) => request("/messages", "POST", v)}
                  fields={[
                    {
                      key: "recipientId",
                      label: admin ? "student" : "brand",
                      options: options(
                        data.people.filter((p: any) => p.status === "active"),
                        (p) => p.name,
                      ),
                    },
                    { key: "subject" },
                    { key: "body", type: "textarea" },
                  ]}
                />
              </section>
              {data.messages.map((m: any) => (
                <article className="p4-card" data-search-target={"message:"+m.id} key={m.id}>
                  <h3>{m.subject}</h3>
                  <p>
                    {m.sender_name} → {m.recipient_name}
                  </p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p>{date(m.created_at)}</p>
                  {m.recipient_id === user.id && !m.read_at && (
                    <button
                      className="p4-button"
                      disabled={busy}
                      onClick={() => act("/messages/" + m.id + "/read")}
                    >
                      {tr("markRead")}
                    </button>
                  )}
                </article>
              ))}
            </>
          )}
          {tab === "notifications" && (
            <>
              <h2>{tr("notifications")}</h2>
              {data.notifications.map((n: any) => (
                <article className="p4-card" data-search-target={"notification:"+n.id} key={n.id}>
                  <h3>
                    {n.title.startsWith("notify_") ? tr(n.title) : n.title}
                  </h3>
                  <p>{n.body}</p>
                  {!n.read_at && (
                    <button
                      className="p4-button"
                      disabled={busy}
                      onClick={() => act("/notifications/" + n.id + "/read", "PATCH")}
                    >
                      {tr("markRead")}
                    </button>
                  )}
                </article>
              ))}
              {!data.notifications.length && <p>{tr("empty")}</p>}
            </>
          )}
          {tab === "contactInbox" && admin && (
            <>
              <h2>{tr("contactInbox")}</h2>
              {data.contacts.map((c: any) => (
                <article className="p4-card" data-search-target={"contact:"+c.id} key={c.id}>
                  <h3>{c.subject}</h3>
                  <p>
                    {c.name} · {c.email}
                  </p>
                  <p className="whitespace-pre-wrap">{c.message}</p>
                  <p>{date(c.created_at)}</p>
                </article>
              ))}
              {!data.contacts.length && <p>{tr("empty")}</p>}
            </>
          )}
          {tab === "audit" && admin && (
            <>
              <h2>{tr("audit")}</h2>
              {data.audit.map((a: any) => (
                <article className="p4-card" data-search-target={"audit:"+a.id} key={a.id}>
                  <p>
                    {a.name} · {date(a.created_at)}
                  </p>
                  <code dir="ltr" className="break-all">
                    {a.action} {a.resource}
                  </code>
                </article>
              ))}
              {!data.audit.length && <p>{tr("empty")}</p>}
            </>
          )}
          {tab === "settings" && (
            <>
              <h2>{tr("settings")}</h2>
              {admin && <TestimonialManager />}
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
              <Link className="p4-text-link" href="/account/password">
                {tr("password")}
              </Link>
              <h3>{tr("sessions")}</h3>
              {data.sessions.map((s: any) => (
                <article className="p4-card p4-row" key={s.id}>
                  <time>{date(s.created_at)}</time>
                  <button
                    disabled={busy}
                    className="p4-button"
                    onClick={() => act("/portal/sessions/" + s.id, "DELETE")}
                  >
                    {tr("revoke")}
                  </button>
                </article>
              ))}
              <button
                className="p4-button"
                onClick={async () => {
                  try {
                    await logoutAll();
                    navigate("/login");
                  } catch {
                    setNotice("failed");
                  }
                }}
              >
                {tr("logoutAll")}
              </button>
            </>
          )}
        </div></Suspense></ContentTransition>
      )}
    </DashboardShell>
  );
}
