import express,{type Express} from 'express';
import helmet from 'helmet';
import compression from 'compression';
import {pool} from './db';
import {dashboardDomain} from './dashboard-domain';
export function configureHttp(app:Express){
 const production=process.env.NODE_ENV==='production';
 const hops=Number(process.env.TRUST_PROXY_HOPS||0);if(!Number.isInteger(hops)||hops<0||hops>5)throw new Error('Invalid TRUST_PROXY_HOPS');
 app.disable('x-powered-by');app.set('trust proxy',hops);app.set('etag',false);
 app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'",'https://challenges.cloudflare.com',...(!production?["'unsafe-inline'"]:[])],frameSrc:['https://challenges.cloudflare.com','https://www.youtube-nocookie.com'],connectSrc:["'self'",'https://challenges.cloudflare.com',...(!production?['ws:','wss:']:[])],imgSrc:["'self'",'data:','https:'],styleSrc:["'self'","'unsafe-inline'"],fontSrc:["'self'"],objectSrc:["'none'"],baseUri:["'self'"],formAction:["'self'"],...(!production?{upgradeInsecureRequests:null}:{})}},crossOriginEmbedderPolicy:false}));
 app.use(compression());
 app.use(dashboardDomain);
 app.get('/health/live',(_req,res)=>res.set('Cache-Control','no-store').json({status:'ok'}));
 app.get('/health/ready',async(_req,res)=>{try{await pool.query('SELECT 1 FROM academy_settings LIMIT 1');res.set('Cache-Control','no-store').json({status:'ready'});}catch{res.status(503).json({status:'unavailable'});}});
 app.use(express.json({limit:'256kb',verify:(req,_res,buf)=>{(req as any).rawBody=buf;}}));
 app.use(express.urlencoded({extended:false,limit:'32kb',parameterLimit:50}));
}
