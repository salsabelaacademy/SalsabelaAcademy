import { pool } from './db';
import { enabled } from './integrations/service';
const minute = 60000;

/** Generate transactional notifications, never send mail or create meetings here. */
export async function queueLessonReminders(at = new Date()) {
  const db = await pool.connect(); let total = 0;
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL statement_timeout='20s'");
    await db.query("SET LOCAL lock_timeout='3s'");
    const lock = (await db.query('SELECT pg_try_advisory_xact_lock(730041) AS locked')).rows[0];
    if (!lock?.locked) { await db.query('ROLLBACK'); return 0; }
    const lessons = (await db.query(`SELECT l.id,l.student_id,l.title,l.starts_at,l.ends_at,u.name AS student_name
      FROM lessons l JOIN users u ON u.id::text=l.student_id::text
      WHERE l.status='scheduled' AND u.role='student' AND u.status='active'
      AND l.starts_at <= $1::timestamptz + interval '10 minutes'
      AND l.starts_at >= $1::timestamptz - interval '5 minutes'
      AND l.ends_at > $1 ORDER BY l.starts_at,l.id LIMIT 100 FOR UPDATE OF l SKIP LOCKED`, [at])).rows;
    for (const lesson of lessons) {
      const start = new Date(lesson.starts_at);
      const kind = at < start ? 'before' : 'start';
      const recipients = (await db.query(`SELECT id,role FROM users WHERE status='active'
        AND (role='admin' OR (role='student' AND id::text=$1::text))`, [String(lesson.student_id)])).rows;
      for (const recipient of recipients) {
        const claimed = await db.query(`INSERT INTO lesson_reminder_dispatches(lesson_id,starts_at,recipient_id,kind)
          VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING lesson_id`, [lesson.id,start,String(recipient.id),kind]);
        if (!claimed.rows.length) continue;
        await db.query('INSERT INTO notifications(user_id,title,body,context) VALUES($1,$2,$3,$4)', [
          recipient.id, 'notify_reminder_' + kind, lesson.title,
          { kind:'lesson_reminder_'+kind, lessonId:lesson.id, startsAt:start.toISOString(), endsAt:new Date(lesson.ends_at).toISOString(), ...(recipient.role==='admin'?{studentName:lesson.student_name}:{}) },
        ]);
        total++;
      }
    }
    await db.query('COMMIT'); return total;
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
}

/** Recheck live schedule and ownership before delivering time-sensitive messages. */
export async function reminderDeliveryState(row: any, at = new Date()) {
  const ctx = row.context || {};
  if (!['lesson_reminder_before','lesson_reminder_start'].includes(ctx.kind)) return {eligible:true,canJoin:false};
  const lesson = (await pool.query('SELECT student_id,starts_at,ends_at,status FROM lessons WHERE id=$1', [ctx.lessonId])).rows[0];
  if (!lesson || lesson.status !== 'scheduled' || !lesson.starts_at || !lesson.ends_at) return {eligible:false,canJoin:false};
  const start = new Date(lesson.starts_at).getTime(), end = new Date(lesson.ends_at).getTime(), now = at.getTime();
  if (start !== Date.parse(ctx.startsAt) || end <= now ||
    (row.role !== 'admin' && String(lesson.student_id) !== String(row.user_id))) return {eligible:false,canJoin:false};
  if (ctx.kind === 'lesson_reminder_before' ? now >= start || now < start-10*minute : now < start || now > start+5*minute)
    return {eligible:false,canJoin:false};
  const meeting = (await pool.query("SELECT join_url FROM integration_meetings WHERE key=$1 AND create_state='ready'", ['lesson:'+ctx.lessonId])).rows[0];
  return {eligible:true,canJoin:Boolean(meeting?.join_url && await enabled('zoom'))};
}

export function startLessonReminderWorker() {
  let stopped=false,busy=false,warned=false;
  const tick=async()=>{
    if(stopped||busy)return;busy=true;
    try { await queueLessonReminders();warned=false; }
    catch { if(!warned)console.warn(JSON.stringify({event:'lesson_reminders_unavailable',action:'check_reminder_migration'}));warned=true; }
    finally {busy=false;}
  };
  const timer=setInterval(()=>void tick(),15000);timer.unref();void tick();
  return ()=>{stopped=true;clearInterval(timer);};
}
