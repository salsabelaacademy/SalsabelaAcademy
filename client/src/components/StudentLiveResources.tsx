import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, Panel, type Row } from "./integration-shared";
export function StudentLiveResources({timezone,refreshKey=0}:{timezone?:string;refreshKey?:number}) {
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState<Row[]>([]), [error, setError] = useState("");
  const tr = (key: string) => t(`integrations.${key}`);
  useEffect(() => { let active = true; void api("/student/sessions").then(s => { if (active) { setSessions(s); setError(""); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [refreshKey]);
  return <div className="space-y-6">
    {error && <p role="alert">{t(`integrations.errors.${error}`, { defaultValue: tr("errors.internal_error") })}</p>}
    <Panel title={tr("lessons")}>{!sessions.length && <p>{tr("empty")}</p>}{sessions.map(s => <article className="space-y-2 border-b py-4" key={`${s.kind}:${s.id}`}><h3 className="font-semibold">{s.title}</h3><p>{s.starts_at ? new Date(s.starts_at).toLocaleString(i18n.language, { timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone }) : "—"} · {timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} · {tr(s.status)}</p>{s.joinUrl ? <a className="inline-block rounded bg-primary px-4 py-3 text-primary-foreground" href={s.joinUrl} target="_blank" rel="noopener noreferrer">{tr("join")}</a> : <p className="text-sm">{tr("unavailable")}</p>}</article>)}</Panel>
  </div>;
}
