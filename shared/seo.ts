import type {Course} from './schema';
import {restorationTranslations} from '../client/src/lib/restoration-translations';
import { phase4Translations } from '../client/src/lib/phase4-translations';
export const publicPaths=['/','/courses','/pricing','/how-it-works','/about','/contact','/apply','/blog'];
export const canonicalOrigin='https://salsabela.com';
export function localizedPath(path:string,lang:string){return lang==='ar'?'/ar'+(path==='/'?'':path):path;}
export function pageMetadata(path:string,lang:'en'|'ar',post?:{title:string;metaDescription?:string|null;language?:string;content?:string}, course?:Course) {
 path=path==='/programs'?'/courses':path;
 const t=phase4Translations[lang],r=restorationTranslations[lang];
 const keys:Record<string,[string,string]>={'/':['hero','intro'],'/programs':['programTitle','quranBody'],'/how-it-works':['howTitle','step1Body'],'/about':['about','aboutBody'],'/contact':['contact','contactIntro'],'/apply':['applicationTitle','applicationIntro'],'/blog':['blog','blogIntro'],'/login':['login','loginDescription'],'/forgot-password':['forgot','accountDescription'],'/reset-password':['password','accountDescription'],'/accept-invitation':['invite','accountDescription'],'/verify-email':['email','accountDescription'],'/resend-verification':['email','accountDescription']};
 const [titleKey,descKey]=keys[path]||[path.startsWith('/admin')||path.startsWith('/dashboard')?'dashboard':'notFound','intro'];
 const title=post?.title||(course?(lang==='ar'?course.titleAr||course.title:course.title):path==='/courses'?r.coursesTitle:path==='/pricing'?r.pricingTitle:path==='/about'?r.aboutTitle:undefined)||(t as any)[titleKey]||t.brand;
 const excerpt=post?.content?.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,160);
 const description=post?.metaDescription||excerpt||(course?(lang==='ar'?course.descriptionAr||course.description:course.description):path==='/courses'?r.coursesIntro:path==='/pricing'?r.pricingIntro:undefined)||(post?post.title+' — '+t.intro:(t as any)[descKey]||t.intro);
 const index=publicPaths.includes(path)||!!post||!!course;
 return {title:title+' | '+t.brand,description,index,url:canonicalOrigin+localizedPath(path,lang),image:canonicalOrigin+'/social-card.png',lang,path,course,alternates:!post&&index};
}
export type PageMetadata=ReturnType<typeof pageMetadata>;

export function structuredData(m:PageMetadata){
 if(!m.index)return [];
 const data:any[]=[{'@context':'https://schema.org','@type':'EducationalOrganization',name:'Salsabela Academy',url:canonicalOrigin,logo:canonicalOrigin+'/images/logo1.webp',description:m.description}];
 if(m.course)data.push({'@context':'https://schema.org','@type':'Course',name:m.lang==='ar'?m.course.titleAr||m.course.title:m.course.title,url:m.url,description:m.description,provider:{'@type':'EducationalOrganization',name:'Salsabela Academy',url:canonicalOrigin}});
 return data;
}
