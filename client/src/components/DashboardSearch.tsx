import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/use-language';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { ArrowUpRight, Search } from 'lucide-react';
export type SearchRecord = {id:number; kind:string; tab:string; title:string; excerpt:string};
export function DashboardSearch({open,onOpenChange,sections,onSection,onRecord}:{open:boolean;onOpenChange:(value:boolean)=>void;sections:string[];onSection:(key:string)=>void;onRecord:(record:SearchRecord)=>void}) {
 const {t}=useTranslation(); const {language}=useLanguage();
 const [query,setQuery]=useState(''),[results,setResults]=useState<SearchRecord[]>([]),[state,setState]=useState<'idle'|'loading'|'ready'|'error'|'limited'>('idle');
 const normalize=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
 const matching=sections.filter(key=>normalize(t('p4.'+key)).includes(normalize(query.trim())));
 useEffect(()=>{
  if(!open){setQuery('');setResults([]);setState('idle');return;}
  setResults([]);setState('idle');
  const q=query.trim();if(q.length<2||q.length>160)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   setState('loading');
   fetch('/api/portal/search?q='+encodeURIComponent(q),{credentials:'include',signal:controller.signal})
    .then(async response=>{if(!response.ok)throw new Error(response.status===429?'limited':'error');return response.json();})
    .then(data=>{if(!controller.signal.aborted){setResults(data.results);setState('ready');}})
    .catch(error=>{if(!controller.signal.aborted)setState(error.message==='limited'?'limited':'error');});
  },250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[query,open]);
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="dash-quick-dialog dash-search-dialog" dir={language==='ar'?'rtl':'ltr'}><DialogHeader><DialogTitle>{t('workspace.searchTitle')}</DialogTitle><DialogDescription>{t('workspace.searchHint')}</DialogDescription></DialogHeader><div className="dash-search-input"><Search size={20} aria-hidden="true"/><input autoFocus type="search" aria-label={t('workspace.searchTitle')} placeholder={t('workspace.searchPlaceholder')} value={query} maxLength={161} onChange={e=>setQuery(e.target.value)} onKeyDown={event=>{if(event.key==='Enter' && query.trim()){event.preventDefault();if(state==='ready' && results[0])onRecord(results[0]);else if(matching[0])onSection(matching[0]);}}} aria-controls="dashboard-search-results" /></div><div id="dashboard-search-results" className="dash-search-results" aria-busy={state==='loading'}>
 {matching.length>0&&<nav aria-label={t('workspace.sections')}><h3>{t('workspace.sections')}</h3>{matching.map(key=><button type="button" key={key} onClick={()=>onSection(key)}><span>{t('p4.'+key)}</span><ArrowUpRight size={17} aria-hidden="true"/></button>)}</nav>}
 <div role="status" aria-live="polite" className="dash-muted">{t('workspace.'+(query.trim().length>160?'tooLong':query.trim().length<2?'minQuery':state==='loading'?'searchLoading':state==='error'?'searchError':state==='limited'?'searchLimited':state==='ready'&&!results.length?'noResults':state==='ready'?'resultCount':'searchLoading'),{count:results.length})}</div>
 {results.length>0&&<section aria-label={t('workspace.results')}><h3>{t('workspace.results')}</h3>{results.map(record=><button className="dash-search-record" type="button" key={record.kind+record.id} onClick={()=>onRecord(record)}><span><small>{t('workspace.recordKinds.'+record.kind)}</small><strong>{record.title.startsWith('notify_')?t('p4.'+record.title):record.title}</strong><span>{record.excerpt}</span></span><ArrowUpRight size={18} aria-hidden="true"/></button>)}</section>}
 </div></DialogContent></Dialog>;
}
