import { useEffect, useRef, type ReactNode } from 'react';
/** One reveal owner per branch. No nested section/card transforms, hidden SSR HTML or loading delay. */
export function PageMotion({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const container=root.current;if(!container)return;
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const seen=new WeakSet<Element>();const animations=new Set<Animation>();
  const selector='[data-reveal], section > .container-wide > *, section > .container-wide';
  const reveal=(element:Element)=>{
   if(seen.has(element))return;seen.add(element);
   if(preference.matches||typeof element.animate!=='function')return;
   const animation=element.animate([{opacity:0,translate:'0 14px'},{opacity:1,translate:'0 0'}],{duration:420,easing:'cubic-bezier(.2,.7,.25,1)'});
   animations.add(animation);element.setAttribute('data-revealed','true');
   animation.onfinish=()=>animations.delete(animation);
  };
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){reveal(entry.target);observer?.unobserve(entry.target);}},{threshold:0.05});
  const observe=()=>container.querySelectorAll(selector).forEach(el=>{
   // Animate the deepest targets only, never their containing section/grid.
   if((el.classList.contains('grid')&&!el.hasAttribute('data-reveal'))||el.querySelector(selector)||seen.has(el)||el.closest('[data-no-reveal]'))return;
   if(observer)observer.observe(el);else reveal(el);
  });
  observe();const mutation=new MutationObserver(observe);mutation.observe(container,{childList:true,subtree:true});
  const stop=()=>{if(preference.matches){animations.forEach(a=>a.cancel());animations.clear();}};
  preference.addEventListener('change',stop);container.dataset.motionReady='true';
  return()=>{observer?.disconnect();mutation.disconnect();preference.removeEventListener('change',stop);animations.forEach(a=>a.cancel());};
 },[]);
 return <div ref={root} className="academy-page-motion">{children}</div>;
}
