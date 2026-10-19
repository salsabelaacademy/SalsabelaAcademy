import type { Express, RequestHandler } from 'express';
import { z } from 'zod';
import webpush from 'web-push';
import { pool } from './db';
import { requireAuth } from './auth';

export function pushConfigured(env = process.env) {
  return Boolean(env.WEB_PUSH_PUBLIC_KEY && env.WEB_PUSH_PRIVATE_KEY && env.WEB_PUSH_SUBJECT);
}
export function allowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    const domains = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'notify.windows.com'];
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && (!url.port || url.port === '443') && domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain));
  } catch { return false; }
}
const endpoint = z.string().max(2048).refine(allowedPushEndpoint);
const subscription = z.object({ endpoint, keys: z.object({p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}={0,2}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/)}).strict(), language: z.enum(['en','ar']) }).strict();
export function registerPushRoutes(app: Express, limit: RequestHandler) {
  const auth = requireAuth(['admin','student']);
  app.get('/api/push/config', auth, (_req,res) => res.set('Cache-Control','no-store').json({ configured: pushConfigured(), publicKey: pushConfigured() ? process.env.WEB_PUSH_PUBLIC_KEY : null }));
  app.post('/api/push/subscriptions/status', auth, async (req,res,next) => {
    try {const value=z.object({endpoint}).strict().parse(req.body);const result=await pool.query('SELECT id FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2',[(req as any).auth.user.id,value.endpoint]);res.json({subscribed:Boolean(result.rowCount)});}catch(error){next(error);}
  });
  app.post('/api/push/subscriptions', auth, limit, async (req,res,next) => {
    try {
      if (!pushConfigured()) return res.status(503).json({code:'not_configured'});
      const value = subscription.parse(req.body), user = (req as any).auth.user;
      await pool.query('INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth,language) VALUES($1,$2,$3,$4,$5) ON CONFLICT(endpoint) DO UPDATE SET user_id=$1,p256dh=$3,auth=$4,language=$5', [user.id,value.endpoint,value.keys.p256dh,value.keys.auth,value.language]);
      res.json({subscribed:true});
    } catch(error) {next(error);}
  });
  app.delete('/api/push/subscriptions', auth, limit, async (req,res,next) => {
    try { const value = z.object({endpoint}).strict().parse(req.body); await pool.query('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2',[(req as any).auth.user.id,value.endpoint]); res.json({subscribed:false}); } catch(error){next(error);}
  });
}
export async function deliverPush(subscription: webpush.PushSubscription, payload: {id:number;language:string}, send = webpush.sendNotification) {
  return send(subscription, JSON.stringify(payload), {vapidDetails:{subject:process.env.WEB_PUSH_SUBJECT!,publicKey:process.env.WEB_PUSH_PUBLIC_KEY!,privateKey:process.env.WEB_PUSH_PRIVATE_KEY!},TTL:3600,timeout:10000});
}
export function startPushWorker() {
  if (!pushConfigured()) return () => {};
  let busy=false, stopped=false;
  const tick=async()=>{
    if(busy || stopped) return; busy=true;
    try {
      for(let i=0;i<10 && !stopped;i++) {
        // Atomic lease supports multiple application instances; crashed jobs become eligible again.
        const result=await pool.query(`UPDATE push_deliveries SET attempts=attempts+1,next_attempt=now()+interval '2 minutes' WHERE id=(SELECT id FROM push_deliveries WHERE status='pending' AND attempts<5 AND next_attempt<=now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
        const job=result.rows[0]; if(!job) break;
        const {rows}=await pool.query(`SELECT s.*,n.user_id AS recipient FROM push_subscriptions s JOIN notifications n ON n.id=$1 JOIN users u ON u.id=s.user_id WHERE s.id=$2 AND s.user_id=n.user_id AND u.status='active' AND n.created_at > now()-interval '24 hours'`,[job.notification_id,job.subscription_id]);
        const sub=rows[0];
        if(!sub || !allowedPushEndpoint(sub.endpoint)){await pool.query("UPDATE push_deliveries SET status='skipped' WHERE id=$1",[job.id]);continue;}
        try {
          await deliverPush({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},{id:job.notification_id,language:sub.language});
          await pool.query("UPDATE push_deliveries SET status='sent',last_error=NULL WHERE id=$1",[job.id]);
        } catch(error) {
          const status=Number((error as {statusCode?:number}).statusCode || 0);
          if(status===404 || status===410) await pool.query('DELETE FROM push_subscriptions WHERE id=$1',[sub.id]);
          else await pool.query("UPDATE push_deliveries SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,last_error=$2,next_attempt=now()+interval '1 minute' * power(2,attempts) WHERE id=$1",[job.id,status ? 'provider_'+status : 'delivery_failed']);
          console.warn(JSON.stringify({event:'push_delivery_failed',status}));
        }
      }
      await pool.query("UPDATE push_deliveries SET status='failed',last_error=COALESCE(last_error,'retry_limit') WHERE status='pending' AND attempts>=5 AND next_attempt<=now()");
    } catch {console.warn(JSON.stringify({event:'push_worker_unavailable'}));}
    finally{busy=false;}
  };
  const timer=setInterval(()=>void tick(),10000);timer.unref();void tick();
  return ()=>{stopped=true;clearInterval(timer);};
}
