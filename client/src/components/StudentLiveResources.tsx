import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { api, Panel, type Row } from "./integration-shared";
export function StudentLiveResources({timezone,refreshKey=0}:{timezone?:string;refreshKey?:number}) {
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState<Row[]>([]), [resources, setResources] = useState<Row[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const tr = (key: string) => t(`integrations.${key}`);
  useEffect(() => { let active = true; void Promise.all([api("/student/sessions"), api("/student/drive-materials")]).then(([s, r]) => { if (active) { setSessions(s); setResources(r); setError(""); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [refreshKey]);
  return <div className="space-y-6">
    {error && <p role="alert">{t(`integrations.errors.${error}`, { defaultValue: tr("errors.internal_error") })}</p>}
    <Panel title={tr("lessons")}>{!sessions.length && <p>{tr("empty")}</p>}{sessions.map(s => <article className="space-y-2 border-b py-4" key={`${s.kind}:${s.id}`}><h3 className="font-semibold">{s.title}</h3><p>{s.starts_at ? new Date(s.starts_at).toLocaleString(i18n.language, { timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone }) : "—"} · {timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} · {tr(s.status)}</p>{s.joinUrl ? <a className="inline-block rounded bg-primary px-4 py-3 text-primary-foreground" href={s.joinUrl} target="_blank" rel="noopener noreferrer">{tr("join")}</a> : <p className="text-sm">{tr("unavailable")}</p>}</article>)}</Panel>
    <Panel title={tr("resources")}>{!resources.length && <p>{tr("empty")}</p>}{resources.map(r => <div className="flex flex-wrap items-center justify-between gap-3 py-3" data-search-target={"resource:"+r.id} key={r.id}><span>{r.title}</span><Button disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const result = await api(`/student/drive-materials/${r.id}/open`, "POST"); window.location.assign(result.url); } catch (e) { setError(e instanceof Error ? e.message : "internal_error"); } finally { setBusy(false); } }}>{tr("open")}</Button></div>)}</Panel>
  </div>;
}
