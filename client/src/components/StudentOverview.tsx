import {useEffect,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Mail,ShieldCheck} from 'lucide-react';
import {AccountAvatar} from './AccountAvatar';
import {LessonCompletion} from './LessonCompletion';
type Overview={account:Record<string,any>;lessons:any[];attendance:any[];reports:number;notices:number};
export function StudentOverview({studentId,revision,onLessons,onAttendance}:{studentId:number;revision:unknown;onLessons:()=>void;onAttendance:()=>void}){
 const {t,i18n}=useTranslation(),tr=(k:string)=>t('polish.'+k),[data,setData]=useState<Overview|null>(null),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();setData(null);setError(false);fetch('/api/admin/students/'+studentId+'/overview',{credentials:'include',cache:'no-store',signal:c.signal}).then(async r=>{if(!r.ok)throw Error('failed');return r.json();}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(true);});return()=>c.abort();},[studentId,revision,retry]);
 if(error)return <div role="alert"><p>{t('p4.failed')}</p><button className="p4-button" onClick={()=>setRetry(v=>v+1)}>{t('p4.retry')}</button></div>;
 if(!data)return <p role="status">{t('p4.loading')}</p>;
 const a=data.account,empty=tr('recordEmpty');
 const date=(v?:string)=>v?new Intl.DateTimeFormat(i18n.language,{dateStyle:'medium',timeZone:a.timezone||'UTC'}).format(new Date(v)):'—';
 const birthday=a.date_of_birth?new Intl.DateTimeFormat(i18n.language,{dateStyle:'long',timeZone:'UTC'}).format(new Date(a.date_of_birth+'T12:00:00Z')):empty;
 const country=a.country&&/^[A-Z]{2}$/.test(a.country)?new Intl.DisplayNames([i18n.language],{type:'region'}).of(a.country):a.country||empty;
 const fields=[['p4.phone',a.phone||empty],['p4.country',country],['refinement.city',a.city||empty],['refinement.dob',birthday],['p4.timezone',a.timezone||'UTC'],['polish.languages',t(a.preferred_language==='ar'?'p4.arabic':'p4.english')],['polish.joined',date(a.created_at)],['experience.lastLogin',date(a.last_login_at)]];
 return <div className="student-overview"><div className="student-detail-profile"><span className="student-avatar"><AccountAvatar user={a as any}/></span><h3>{a.name}</h3><p><Mail size={16} aria-hidden/><bdi>{a.email}</bdi></p><p><ShieldCheck size={16} aria-hidden/>{tr(a.email_verified_at?'verified':'unverified')} · {t('p4.states.'+a.status)}</p></div><section><h3>{tr('studentAccount')}</h3><dl className="student-account-data">{fields.map(([key,value])=><div key={key}><dt>{t(key!)}</dt><dd><bdi>{value}</bdi></dd></div>)}<div className="student-bio"><dt>{t('refinement.bio')}</dt><dd>{a.bio||empty}</dd></div>{a.learning_goals&&<div className="student-bio"><dt>{tr('goals')}</dt><dd>{a.learning_goals}</dd></div>}</dl></section><section><h3>{tr('studentProgress')}</h3><LessonCompletion admin={false} lessons={data.lessons} attendance={data.attendance} timezone={a.timezone||'UTC'} onOpen={onLessons} onAttendance={onAttendance}/></section><div className="student-overview-counts">{[['reports',data.reports],['notices',data.notices]].map(([key,value])=><div key={key}><strong>{new Intl.NumberFormat(i18n.language).format(Number(value))}</strong><span>{tr(String(key))}</span></div>)}</div></div>;
}

