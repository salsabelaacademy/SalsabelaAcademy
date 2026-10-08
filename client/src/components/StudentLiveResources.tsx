import {useQuery} from "@tanstack/react-query";
import {useAuth} from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import { api, Panel, type Row } from "./integration-shared";
export function StudentLiveResources({timezone,refreshKey=0}:{timezone?:string;refreshKey?:number}) {
  const { t, i18n } = useTranslation();
  const tr = (key: string) => t(`integrations.${key}`);
  const {user}=useAuth();
  const {data:sessions=[],isError}=useQuery<Row[]>({queryKey:['student-live-sessions',user?.id,refreshKey],queryFn:()=>api('/student/sessions'),refetchInterval:10000,refetchIntervalInBackground:false,refetchOnWindowFocus:true});
  const upcoming=sessions.filter(s=>['scheduled','confirmed'].includes(s.status)&&s.starts_at&&new Date(s.ends_at).getTime()>Date.now()).sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime());
  return <div className="space-y-6">
    {isError && <p role="alert">{tr("errors.internal_error")}</p>}
    <Panel title={tr("lessons")}>{!upcoming.length && <p>{tr("empty")}</p>}{upcoming.map(s => <article className="space-y-2 border-b py-4" key={`${s.kind}:${s.id}`}><h3 className="font-semibold">{s.title}</h3><p>{s.starts_at ? new Date(s.starts_at).toLocaleString(i18n.language, { timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone }) : "—"} · {timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} · {tr(s.status)}</p>{s.joinUrl ? <a className="inline-block rounded bg-primary px-4 py-3 text-primary-foreground" href={s.joinUrl} target="_blank" rel="noopener noreferrer">{t("dashboardUpdate.startLesson")}</a> : <p className="text-sm">{tr("unavailable")}</p>}</article>)}</Panel>
  </div>;
}
