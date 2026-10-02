import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/use-language';
export function LessonCompletion({lessons,admin,onOpen}:{lessons:{status:string}[];admin:boolean;onOpen:()=>void}) {
 const {t}=useTranslation();const {language}=useLanguage();
 const completed=lessons.filter(l=>l.status==='completed').length;
 const remaining=lessons.filter(l=>l.status==='scheduled').length;
 const total=completed+remaining,percent=total?Math.round(completed/total*100):0;
 const format=(value:number)=>new Intl.NumberFormat(language).format(value);
 const label=total?t('workspace.completionCounts',{completed:format(completed),remaining:format(remaining)}):t('workspace.completionEmpty');
 return <section className="dash-panel dash-completion"><h2>{t('workspace.'+(admin?'academyCompletion':'lessonCompletion'))}</h2><button className="dash-completion-open" type="button" onClick={onOpen} aria-label={t('review.openSection',{section:t('p4.lessons')})}><div className="dash-completion-ring"><svg viewBox="0 0 120 120" role="img" aria-label={label}><circle cx="60" cy="60" r="49" className="dash-ring-track"/><circle cx="60" cy="60" r="49" className="dash-ring-value" style={{opacity:completed?1:0}} pathLength="100" strokeDasharray={`${total?completed/total*100:0} 100`} transform="rotate(-90 60 60)"/></svg><span aria-hidden="true"><strong>{total?new Intl.NumberFormat(language,{style:'percent',maximumFractionDigits:0}).format(percent/100):'—'}</strong><small>{t('workspace.completed')}</small></span></div></button><dl className="dash-ring-legend"><div><dt>{t('workspace.completed')}</dt><dd>{format(completed)}</dd></div><div><dt>{t('workspace.remaining')}</dt><dd>{format(remaining)}</dd></div></dl><p>{total?t('workspace.completionNote'):label}</p></section>;
}
