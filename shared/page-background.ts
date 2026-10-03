import manifest from '../client/src/lib/page-backgrounds.json';
/** Same local asset for SSR preload, SPA navigation and the rendered hero. */
export function pageBackground(path:string):string|null {
 const plain=(path.split(/[?#]/)[0]||'/').replace(/^\/ar(?=\/|$)/,'')||'/';
 const variants:Record<string,string>={'/courses':'courses','/programs':'courses','/pricing':'pricing','/blog':'journal','/how-it-works':'journey','/contact':'contact','/about':'about','/apply':'apply'};
 const variant=plain.startsWith('/courses/')?'courses':variants[plain];
 if(!variant)return null;
 const image=(manifest as Record<string,{src:string}>)[variant]?.src||'/images/home-mosque.webp';
 return /^\/images\/[a-zA-Z0-9._-]+$/.test(image)?image:null;
}
export function backgroundPreload(path:string):string {
 const src=pageBackground(path);
 return src?'<link data-background-priority rel="preload" as="image" href="'+src+'" fetchpriority="high">':'';
}

