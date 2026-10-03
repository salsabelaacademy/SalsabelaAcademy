import {backgroundPreload} from '../shared/page-background';
import {publicCourses,resolvePublicCourse} from './public-courses';
import express,{type Express} from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {publicPaths,canonicalOrigin,localizedPath,pageMetadata,structuredData} from '../shared/seo';
import {renderPublic} from './seo-render';
import {pool} from './db';
import sanitizeHtml from 'sanitize-html';
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function metadataHtml(m:ReturnType<typeof pageMetadata>){
 const tags=[`<title>${esc(m.title)}</title>`,`<meta name="description" content="${esc(m.description)}">`,`<meta name="robots" content="${m.index?'index,follow':'noindex,nofollow'}">`,`<link rel="canonical" href="${esc(m.url)}">`];
 for(const [k,v] of Object.entries({'og:title':m.title,'og:description':m.description,'og:url':m.url,'og:image':m.image,'og:type':'website','og:locale':m.lang==='ar'?'ar':'en_US','og:image:width':'1200','og:image:height':'630'})) tags.push(`<meta property="${k}" content="${esc(v)}">`);
 for(const [k,v] of Object.entries({'twitter:card':'summary_large_image','twitter:title':m.title,'twitter:description':m.description,'twitter:image':m.image}))tags.push(`<meta name="${k}" content="${esc(v)}">`);
 if(m.alternates)for(const lang of ['en','ar','x-default'])tags.push(`<link rel="alternate" hreflang="${lang}" href="${canonicalOrigin+localizedPath(m.path,lang)}">`);
 for(const data of structuredData(m)) tags.push(`<script data-seo type="application/ld+json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`);
 return tags.join('\n');
}
export function serveStatic(app:Express, directory=path.resolve(typeof __dirname==='undefined'?process.cwd()+'/dist':__dirname,'public')) {
 if(!fs.existsSync(directory))throw new Error('Production build missing');
 app.get('/index.html',(_req,res)=>res.redirect(301,'/'));
 const template=fs.readFileSync(path.join(directory,'index.html'),'utf8');
 app.get('/robots.txt',(_req,res)=>res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${canonicalOrigin}/sitemap.xml\n`));
 app.get('/sitemap.xml',async(_req,res,next)=>{try{
  const posts=(await pool.query("SELECT slug,language,updated_at FROM posts WHERE status='published' AND language IN ('en','ar') ORDER BY id")).rows;
  const paths=[...publicPaths,...(await publicCourses()).map(c=>"/courses/"+c.id)];
  const urls=paths.flatMap(p=>['en','ar'].map(l=>`<url><loc>${canonicalOrigin+localizedPath(p,l)}</loc>${['en','ar','x-default'].map(a=>`<xhtml:link rel="alternate" hreflang="${a}" href="${canonicalOrigin+localizedPath(p,a)}"/>`).join('')}</url>`));
  for(const p of posts)urls.push(`<url><loc>${esc(canonicalOrigin+localizedPath('/blog/'+p.slug,p.language))}</loc><lastmod>${new Date(p.updated_at).toISOString()}</lastmod></url>`);
  res.set('Cache-Control','public, max-age=60').type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`);
 }catch(e){next(e);}});
 app.use('/assets',express.static(path.join(directory,'assets'),{immutable:true,maxAge:'1y',index:false}));
 app.use(express.static(directory,{index:false,maxAge:'1h',setHeaders:(res,file)=>{if(file.endsWith('.html'))res.setHeader('Cache-Control','no-store');}}));
 app.get('/{*path}',async(req,res,next)=>{try{
  const lang=/^\/ar(?:\/|$)/.test(req.path)?'ar':'en', plain=req.path.replace(/^\/ar(?=\/|$)/,'')||'/';
  if(plain==='/programs')return res.redirect(301,localizedPath('/courses',lang));
  if(plain!=='/'&&plain.endsWith('/'))return res.redirect(301,localizedPath(plain.slice(0,-1),lang));
  const privatePage=/^\/(?:login|forgot-password|reset-password|accept-invitation|verify-email|resend-verification|account\/password|dashboard\/(?:admin|student)|admin(?:\/(?:integrations|new|edit\/\d+))?)$/.test(plain);
  let data:any;
  const catalogue = ['/', '/courses', '/contact', '/apply'].includes(plain)||plain.startsWith('/courses/') ? await publicCourses() : undefined;
  const course = plain.startsWith('/courses/') ? await resolvePublicCourse(plain.slice(9)) : undefined;
  if(course && plain !== '/courses/'+course.id)return res.redirect(301,localizedPath('/courses/'+course.id,lang));
  if(plain==='/blog')data=(await pool.query("SELECT id,title,slug,created_at AS \"createdAt\",updated_at AS \"updatedAt\",language,meta_description AS \"metaDescription\",cover_image AS \"coverImage\" FROM posts WHERE status='published' AND language=$1 ORDER BY created_at DESC",[lang])).rows;
  else if(plain.startsWith('/blog/')){data=(await pool.query("SELECT title,content,created_at AS \"createdAt\",updated_at AS \"updatedAt\",language,meta_description AS \"metaDescription\",cover_image AS \"coverImage\" FROM posts WHERE slug=$1 AND status='published' AND language=$2",[plain.slice(6),lang])).rows[0];if(data)data.content=sanitizeHtml(data.content);}
  const found=publicPaths.includes(plain)||!!data||!!course||privatePage;
  const m=pageMetadata(plain,lang,plain.startsWith('/blog/')?data:undefined,course);
  const body=privatePage?'':await renderPublic(plain,lang,data,catalogue);
  const html=template.replace(/<html[^>]*>/,`<html lang="${lang}" dir="${lang==='ar'?'rtl':'ltr'}">`).replace(/<title>[\s\S]*?<\/title>/g,'').replace(/<meta\s+(?:name="(?:description|robots|twitter:[^"]*)"|property="og:[^"]*")[^>]*>/g,'').replace('</head>',()=>metadataHtml(m)+backgroundPreload(plain)+'</head>').replace('<div id="root"></div>',()=>`<div id="root">${body}</div>`);
  res.status(found?200:404).set('Cache-Control','no-store').set('X-Robots-Tag',m.index?'index,follow':'noindex,nofollow').type('html').send(html);
 }catch(e){
  let cause:any=e, unavailable=false;
  for(let depth=0;cause&&depth<6;depth++,cause=cause.cause){
   if(['ECONNREFUSED','ECONNRESET','ETIMEDOUT','57P01','57P02','57P03','53300'].includes(cause.code||'') || /timeout|connection terminated/i.test(cause.message||''))unavailable=true;
  }
  if(unavailable){
   const ar=/^\/ar(?:\/|$)/.test(req.path);
   const title=ar?'الخدمة غير متاحة مؤقتًا':'Temporarily unavailable';
   const message=ar?'تعذّر الاتصال ببيانات الأكاديمية. يرجى المحاولة مرة أخرى بعد قليل.':'We could not connect to the academy data. Please try again shortly.';
   res.status(503).set('Cache-Control','no-store').set('Retry-After','30').set('X-Robots-Tag','noindex,nofollow').type('html').send(`<!doctype html><html lang="${ar?'ar':'en'}" dir="${ar?'rtl':'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body><main><h1>${title}</h1><p>${message}</p><a href="${esc(req.path)}">${ar?'إعادة المحاولة':'Try again'}</a></main></body></html>`);
   return;
  }
  next(e);
 }});
}
