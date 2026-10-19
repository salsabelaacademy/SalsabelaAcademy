import type { Express } from 'express';
import { pool } from './db';
import { getUserFromRequest, requireAuth } from './auth';
import { enabled } from './integrations/service';
import { safeZoomUrl } from './integrations/security';
import { zoom, zoomToken } from './integrations/providers';
import { lessonDashboard, safeLessonReturn } from '../shared/lesson-links';

export function registerLessonEntryRoutes(app: Express, options: {
  zoomEnabled?:()=>Promise<boolean>;
  hostMeeting?:(id:string)=>Promise<any>;
} = {}) {
  app.get('/api/lessons/:id/entry-status', requireAuth(['admin','student']), async(req,res,next)=>{
    res.set('Cache-Control','no-store');
    try {
      if(!/^[1-9]\d{0,9}$/.test(String(req.params.id)))return res.sendStatus(404);
      const user=(req as any).auth.user;
      const lesson=(await pool.query('SELECT student_id,starts_at,ends_at,status FROM lessons WHERE id=$1',[req.params.id])).rows[0];
      if(!lesson)return res.sendStatus(404);
      if(user.role!=='admin'&&String(user.id)!==String(lesson.student_id))return res.sendStatus(403);
      const now=Date.now(),start=new Date(lesson.starts_at).getTime(),end=new Date(lesson.ends_at).getTime();
      const inWindow=Boolean(lesson.starts_at&&lesson.ends_at&&lesson.status==='scheduled'&&now>=start-15*60000&&now<end);
      const meeting=inWindow?(await pool.query("SELECT zoom_id,join_url FROM integration_meetings WHERE key=$1 AND create_state='ready'",['lesson:'+req.params.id])).rows[0]:null;
      const available=Boolean(meeting?.zoom_id&&meeting.join_url&&await(options.zoomEnabled||(()=>enabled('zoom')))());
      res.json({available});
    }catch(error){next(error);}
  });
  app.get('/api/lessons/:id/join', async (req,res,next)=>{
    res.set({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex,nofollow'});
    const language=req.query.lang==='ar'?'ar':'en';
    try {
      if(!/^[1-9]\d{0,9}$/.test(String(req.params.id)))return res.sendStatus(404);
      const auth=await getUserFromRequest(req);
      if(!auth){
        const target=safeLessonReturn(req.originalUrl);
        return res.redirect(303,(language==='ar'?'/ar':'')+'/login'+(target?'?next='+encodeURIComponent(target):''));
      }
      const lesson=(await pool.query('SELECT id,student_id,starts_at,ends_at,status FROM lessons WHERE id=$1',[req.params.id])).rows[0];
      if(!lesson)return res.sendStatus(404);
      if(auth.user.role!=='admin' && String(lesson.student_id)!==String(auth.user.id))return res.sendStatus(403);
      const fallback=()=>res.redirect(303,lessonDashboard(lesson.id,auth.user.role,language)+'&join=unavailable');
      const now=Date.now(),start=new Date(lesson.starts_at).getTime(),end=new Date(lesson.ends_at).getTime();
      if(lesson.status!=='scheduled'||!lesson.starts_at||!lesson.ends_at||now<start-15*60000||now>=end||
        (typeof req.query.at==='string' && Date.parse(req.query.at)!==start))return fallback();
      if(!(await (options.zoomEnabled||(()=>enabled('zoom')))()))return fallback();
      const meeting=(await pool.query("SELECT zoom_id,join_url FROM integration_meetings WHERE key=$1 AND create_state='ready'",['lesson:'+lesson.id])).rows[0];
      if(!meeting?.zoom_id||!meeting.join_url)return fallback();
      let url=meeting.join_url;
      if(auth.user.role==='admin'){
        try{url=(await (options.hostMeeting|| (async id=>zoom('/meetings/'+id,await zoomToken())))(meeting.zoom_id)).start_url;}
        catch{return fallback();}
      }
      try{return res.redirect(303,safeZoomUrl(url));}catch{return fallback();}
    }catch(error){next(error);}
  });
}
