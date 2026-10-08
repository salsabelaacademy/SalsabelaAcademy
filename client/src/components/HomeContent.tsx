import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import useEmblaCarousel from 'embla-carousel-react';
import { Link } from 'wouter';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/hooks/use-language';
import { usePosts } from '@/hooks/use-posts';
import type { Testimonial } from '@shared/testimonials';

function StudentReviews({items}:{items:Testimonial[]}){
 const {t}=useTranslation();const {isRTL}=useLanguage();const tr=(k:string)=>t('homeContent.'+k);
 const [viewport,api]=useEmblaCarousel({align:'start',direction:isRTL?'rtl':'ltr',slidesToScroll:1});
 const [running,setRunning]=useState(false),[hover,setHover]=useState(false),[focusHold,setFocusHold]=useState(false),[canScroll,setCanScroll]=useState(false);
 const [reduced,setReduced]=useState(false);
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');const sync=()=>{setReduced(m.matches);setRunning(!m.matches);};sync();m.addEventListener('change',sync);return()=>m.removeEventListener('change',sync);},[]);
 const update=useCallback(()=>setCanScroll((api?.scrollSnapList().length||0)>1),[api]);
 useEffect(()=>{if(!api)return;update();api.on('reInit',update);return()=>{api.off('reInit',update);};},[api,update]);
 useEffect(()=>{if(!api||!running||hover||focusHold||reduced||!canScroll)return;const timer=setInterval(()=>{if(document.hidden)return;if(api.canScrollNext())api.scrollNext();else api.scrollTo(0);},8000);return()=>clearInterval(timer);},[api,running,hover,focusHold,reduced,canScroll]);
 return <section className="py-20 bg-slate-900 text-white" aria-labelledby="reviews-heading">
  <div className="container-wide">
   <div className="text-center max-w-2xl mx-auto mb-10"><h2 id="reviews-heading" className="text-3xl lg:text-4xl font-display font-bold mb-4">{tr('feedback')}</h2><p className="text-slate-300">{tr('feedbackIntro')}</p></div>
   <div data-no-reveal onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)} onFocusCapture={()=>setFocusHold(true)} onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget))setFocusHold(false);}} aria-roledescription={t("pageUi.HomeContent.carousel")} aria-label={tr('feedback')}>
    <div ref={viewport} className="overflow-hidden" onPointerDown={()=>setRunning(false)}><div className="flex -ms-6 touch-pan-y">
     {items.map(item=><div key={item.id} className="min-w-0 flex-[0_0_100%] md:flex-[0_0_50%] lg:flex-[0_0_33.333%] ps-6"><figure className="student-review-card h-full rounded-2xl border border-white/15 bg-white/5 p-7 flex flex-col">
      <span aria-hidden="true" className="text-5xl leading-none text-amber-300 font-serif">“</span>
      <blockquote className="text-base leading-8 whitespace-pre-line break-words flex-1">{item.quote}</blockquote>
      <figcaption className="review-person mt-7 pt-5 border-t border-white/15"><img src="/default-male-avatar.svg" alt={t('dashboardUpdate.defaultAvatar')} width={48} height={48} loading="lazy"/><div><p className="font-bold text-amber-200 break-words">{item.name}</p>{item.location&&<p className="text-sm text-slate-300 mt-1 break-words">{item.location}</p>}</div></figcaption>
     </figure></div>)}
    </div></div>
    {canScroll&&<div className="flex flex-wrap justify-center gap-3 mt-7">
     <button className="review-control" aria-label={tr('previous')} onClick={()=>{setRunning(false);if(api?.canScrollPrev())api.scrollPrev(reduced);else api?.scrollTo(items.length-1,reduced);}}>{isRTL?'→':'←'}</button>
     {!reduced&&<button className="review-control px-5" onClick={()=>{setRunning(v=>!v);setFocusHold(false);}}>{tr(running?'pause':'play')}</button>}
     <button className="review-control" aria-label={tr('next')} onClick={()=>{setRunning(false);if(api?.canScrollNext())api.scrollNext(reduced);else api?.scrollTo(0,reduced);}}>{isRTL?'←':'→'}</button>
    </div>}
   </div>
  </div>
 </section>;
}
export function HomeContent(){
 const {language}=useLanguage();const {t}=useTranslation();const tr=(k:string)=>t('homeContent.'+k);
 const {data:reviews=[]}=useQuery<Testimonial[]>({queryKey:['/api/testimonials',language],queryFn:async()=>{const r=await fetch('/api/testimonials?lang='+language);if(!r.ok)throw new Error('Reviews unavailable');return r.json();},staleTime:60000});
 const {data:posts=[]}=usePosts(language,3);
 const latest=[...posts].filter(p=>p.status==='published').sort((a,b)=>new Date(b.createdAt||0).getTime()-new Date(a.createdAt||0).getTime()).slice(0,3);
 return <>
  {reviews.length>0&&<StudentReviews key={language} items={reviews}/>}
  {latest.length>0&&<section className="py-20 bg-white dark:bg-slate-900" aria-labelledby="latest-heading"><div className="container-wide">
   <div className="text-center max-w-2xl mx-auto mb-10"><h2 id="latest-heading" className="text-3xl lg:text-4xl font-display font-bold mb-4">{tr('latest')}</h2><p className="text-slate-600 dark:text-slate-300">{tr('latestIntro')}</p></div>
   <div className="grid grid-cols-1 md:grid-cols-3 gap-7">{latest.map(post=><article data-reveal key={post.id} className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
    {post.coverImage&&<img src={post.coverImage} alt={post.title} width={640} height={400} loading="lazy" decoding="async" className="w-full aspect-[8/5] object-cover"/>}
    <div className="p-6 flex flex-col flex-1"><h3 className="font-display text-xl font-bold mb-4 break-words">{post.title}</h3>{post.metaDescription&&<p className="text-slate-600 dark:text-slate-300 line-clamp-3 mb-5">{post.metaDescription}</p>}<Link href={'/blog/'+post.slug} className="mt-auto inline-flex min-h-11 items-center text-primary font-semibold">{tr('readMore')}<span className="sr-only">: {post.title}</span></Link></div>
   </article>)}</div><div className="mt-8 text-center"><Link href="/blog" className="btn-primary inline-flex min-h-11 items-center">{tr('allPosts')}</Link></div>
  </div></section>}
 </>;
}
