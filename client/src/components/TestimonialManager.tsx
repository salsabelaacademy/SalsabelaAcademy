import {useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import type {Testimonial} from '@shared/testimonials';
const empty={name:'',quote:'',location:'',language:'en' as 'en'|'ar',consent:false,published:false};
async function request(path='',method='GET',body?:unknown){const r=await fetch('/api/portal/testimonials'+path,{method,credentials:'include',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});if(!r.ok)throw new Error('failed');return r.json();}
export function TestimonialManager(){
 const {t}=useTranslation();const tr=(k:string)=>t('homeContent.'+k);const qc=useQueryClient();
 const {data:items=[],isLoading,isError}=useQuery<Testimonial[]>({queryKey:['admin-testimonials'],queryFn:()=>request()});
 const [value,setValue]=useState(empty),[id,setId]=useState<number|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const refresh=async()=>{await qc.invalidateQueries({queryKey:['admin-testimonials']});await qc.invalidateQueries({queryKey:['/api/testimonials']});};
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setMessage('');try{await request(id?'/'+id:'',id?'PUT':'POST',value);setValue(empty);setId(null);setMessage('saved');await refresh();}catch{setMessage('failed');}finally{setBusy(false);}}
 async function remove(id:number){if(busy||!confirm(tr('confirmDelete')))return;setBusy(true);try{await request('/'+id,'DELETE');if(id===editingId){setId(null);setValue(empty);}setMessage('deleted');await refresh();}catch{setMessage('failed');}finally{setBusy(false);}}
 const editingId=id;
 return <section className="p4-card"><h3>{tr('manage')}</h3><p>{tr('manageHint')}</p>
  {isLoading&&<p role="status">{tr('loading')}</p>}{isError&&<p role="alert">{tr('failed')}</p>}
  <form onSubmit={submit}>
   <label>{tr('name')}<input required maxLength={100} value={value.name} onChange={e=>setValue({...value,name:e.target.value})}/></label>
   <label>{tr('quote')}<textarea required minLength={10} maxLength={2000} rows={5} value={value.quote} onChange={e=>setValue({...value,quote:e.target.value})}/></label>
   <label>{tr('location')}<input maxLength={100} value={value.location} onChange={e=>setValue({...value,location:e.target.value})}/></label>
   <label>{tr('language')}<select value={value.language} onChange={e=>setValue({...value,language:e.target.value as 'en'|'ar'})}><option value="en">{t("p4.english")}</option><option value="ar">{t("p4.arabic")}</option></select></label>
   <label className="review-check"><input type="checkbox" checked={value.consent} onChange={e=>setValue({...value,consent:e.target.checked,published:e.target.checked&&value.published})}/>{tr('consent')}</label>
   <label className="review-check"><input type="checkbox" disabled={!value.consent} checked={value.published} onChange={e=>setValue({...value,published:e.target.checked})}/>{tr('published')}</label>
   <div className="flex gap-3"><button className="p4-button" disabled={busy}>{tr(busy?'saving':'save')}</button>{id&&<button type="button" onClick={()=>{setId(null);setValue(empty);setMessage('');}}>{tr('cancel')}</button>}</div>
   {message&&<p role={message==='failed'?'alert':'status'}>{tr(message)}</p>}
  </form>
  {!isLoading&&!isError&&!items.length&&<p>{tr('empty')}</p>}
  {items.map(item=><article key={item.id} className="border-t border-slate-200 dark:border-slate-700 py-5 mt-5"><p className="font-bold">{item.name} · {t(item.language === "ar" ? "p4.arabic" : "p4.english")} · {tr(item.published?'live':'draft')}</p><p className="whitespace-pre-line break-words">{item.quote}</p><div className="flex gap-3"><button disabled={busy} onClick={()=>{const {id,...fields}=item;setId(id);setValue(fields);setMessage('');}}>{tr('edit')}</button><button disabled={busy} onClick={()=>remove(item.id)}>{tr('remove')}</button></div></article>)}
 </section>;
}
