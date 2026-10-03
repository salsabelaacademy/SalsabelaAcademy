import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, ClipboardCheck, BellRing, Check, Frown, Meh, Smile, SmilePlus, Laugh } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { issueKinds } from '@shared/lesson-followup';

export async function followupRequest(path: string, method='GET', body?: unknown) {
  const response = await fetch('/api'+path,{method,credentials:'include',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const value = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(value.code==='schedule_conflict'?'scheduleConflict':value.code==='invalid_time'?'invalid':['invalid','missing','limited','conflict','cancelled','reportFuture'].includes(value.code)?value.code:'failed');
  return value;
}
export function useLessonUpdates(revision: number) {
  const [updates,setUpdates]=useState<any[]>([]),[error,setError]=useState('');
  useEffect(()=>{let live=true;followupRequest('/portal/lesson-updates').then(value=>{if(live){setUpdates(value);setError('');}}).catch(()=>{if(live)setError('failed');});return()=>{live=false;};},[revision]);
  return {updates,error};
}
export function FollowupHistory({updates,error,lessonId,studentId}:{updates:any[];error?:string;lessonId?:number;studentId?:number}) {
  const {t,i18n}=useTranslation(),tr=(key:string)=>t('followup.'+key);
  const list=updates.filter(v=>(!lessonId||v.lesson_id===lessonId)&&(!studentId||v.student_id===studentId));
  return <section className="followup-history"><h3>{tr('history')}</h3>{error&&<p role="alert">{tr(error)}</p>}{!error&&!list.length&&<p>{tr('noHistory')}</p>}{list.map(v=><article key={v.id} className="followup-history-item"><div className="p4-row"><span className="p4-badge">{tr(v.kind==='report'?'report':v.issue_kind)}</span><time dateTime={v.created_at}>{new Date(v.created_at).toLocaleDateString(i18n.language,{dateStyle:'medium'})}</time></div><h4>{v.title}</h4>{v.adjust_plan&&<span className="p4-badge">{tr('adjustPlan')}</span>}{v.kind==='report'&&<><p className="followup-preline">{v.covered}</p><div className="followup-scores"><span>{tr('behavior')} <strong>{v.behavior}/5</strong></span><span>{tr('participation')} <strong>{v.participation}/5</strong></span></div></>}{v.comment&&<p className="followup-preline">{v.comment}</p>}</article>)}</section>;
}
const localInput=(date:string)=>{const d=new Date(date);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
export function deviceSchedule(values: {startsAt:string;endsAt:string}) {
  const start=new Date(values.startsAt),end=new Date(values.endsAt);
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end.getTime()-start.getTime()>86400000||localInput(start.toISOString())!==values.startsAt||localInput(end.toISOString())!==values.endsAt)throw new Error('invalid');
  return {startsAt:start.toISOString(),endsAt:end.toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};
}
function Rating({name,label}:{name:string;label:string}) {
  const {t}=useTranslation();
  return <fieldset className="followup-rating"><legend>{label}</legend><div>{[1,2,3,4,5].map(value=>{const Icon=[Frown,Meh,Smile,SmilePlus,Laugh][value-1];return <label key={value}><input required type="radio" name={name} value={value} aria-label={t('followup.rating'+value)}/><span><Icon size={25} aria-hidden/><small>{t('followup.rating'+value)}</small></span></label>;})}</div></fieldset>;
}
export function LessonActions({lesson,onDone}:{lesson:any;onDone:()=>void}) {
  const {t,i18n}=useTranslation(),tr=(key:string)=>t('followup.'+key);
  const [mode,setMode]=useState<'report'|'issue'|'reschedule'|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[requestKey,setRequestKey]=useState('');
  const reportAllowed=lesson.starts_at&&new Date(lesson.starts_at).getTime()<=Date.now();
  const open=(next:typeof mode)=>{setMode(next);setMessage('');setRequestKey(crypto.randomUUID());};
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;const values=Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);setMessage('');
    try {
      if(mode==='reschedule') {
        await followupRequest(`/admin/lessons/${lesson.id}`,'PATCH',deviceSchedule({startsAt:String(values.startsAt),endsAt:String(values.endsAt)}));
        setMessage('savedSchedule');
      } else {
        const body=mode==='report'?{kind:'report',covered:values.covered,adjustPlan:values.adjustPlan==='yes',behavior:Number(values.behavior),participation:Number(values.participation),comment:values.comment,requestKey}:{kind:'issue',issueKind:values.issueKind,comment:values.comment,requestKey};
        await followupRequest(`/admin/lessons/${lesson.id}/followup`,'POST',body);setMessage('sent');
      }
      onDone();
    } catch(e) {setMessage(e instanceof Error?e.message:'failed');} finally {setBusy(false);}
  }
  if(lesson.status==='cancelled')return null;
  return <><div className="lesson-action-bar">{lesson.status==='scheduled'&&<button type="button" onClick={()=>open('reschedule')}><CalendarClock aria-hidden size={18}/>{tr('reschedule')}</button>}<button type="button" onClick={()=>open('issue')}><BellRing aria-hidden size={18}/>{tr('issue')}</button><button type="button" onClick={()=>open('report')} disabled={!reportAllowed} title={!reportAllowed?tr('reportFuture'):undefined}><ClipboardCheck aria-hidden size={18}/>{tr('report')}</button></div>
    <Sheet open={mode!==null} onOpenChange={value=>{if(!value&&!busy)setMode(null);}}><SheetContent side={i18n.dir()==='rtl'?'left':'right'} overlayClassName="academy-detail-overlay" className="academy-detail-sheet" dir={i18n.dir()}><SheetHeader className="academy-detail-heading"><SheetTitle>{tr(mode||'report')}</SheetTitle><SheetDescription>{lesson.title}</SheetDescription></SheetHeader>
      <form className="followup-form" onSubmit={submit} key={mode}>
        {mode==='report'&&<><label>{tr('covered')}<textarea name="covered" required rows={4} maxLength={3000}/><small>{tr('coveredHint')}</small></label><label className="followup-adjust"><input type="checkbox" name="adjustPlan" value="yes"/><span>{tr('adjustPlan')}</span></label><small>{tr('adjustPlanHint')}</small><Rating name="behavior" label={tr('behavior')}/><Rating name="participation" label={tr('participation')}/></>}
        {mode==='issue'&&<fieldset className="followup-issues"><legend>{tr('chooseIssue')}</legend>{issueKinds.map(kind=><label key={kind}><input type="radio" name="issueKind" value={kind} required/><span>{tr(kind)}</span></label>)}</fieldset>}
        {mode==='reschedule'?<><p>{tr('browserTime')} <bdi>{Intl.DateTimeFormat().resolvedOptions().timeZone}</bdi></p><label>{tr('start')}<input name="startsAt" type="datetime-local" required defaultValue={localInput(lesson.starts_at)}/></label><label>{tr('end')}<input name="endsAt" type="datetime-local" required defaultValue={localInput(lesson.ends_at)}/></label></>:<label>{tr('comment')}<textarea name="comment" maxLength={3000} rows={3}/></label>}
        {!['sent','savedSchedule'].includes(message)&&<button className="p4-button" disabled={busy}>{busy?tr('sending'):tr(mode==='reschedule'?'saveSchedule':'send')}</button>}
        {message&&<p role={['sent','savedSchedule'].includes(message)?'status':'alert'} className="followup-result">{['sent','savedSchedule'].includes(message)&&<Check aria-hidden size={18}/>} {tr(message)}</p>}
        {mode!=='reschedule'&&<p className="followup-privacy">{tr('phoneHint')}</p>}
      </form>
    </SheetContent></Sheet>
  </>;
}
