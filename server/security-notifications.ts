import { pool } from './db';
import type { SqlConnection } from './message-storage-check';

/** Must run in the account operation's transaction; contains no password/token/IP. */
export async function insertSecurityNotice(db: SqlConnection, userId: number | string, kind: 'login'|'password') {
  const title='notify_security_'+kind;
  return db.query(`INSERT INTO notifications(user_id,title,body,context)
    SELECT $3,$2,'',jsonb_build_object('kind',$2::text,'occurredAt',now())
    FROM users u WHERE u.id::text=$1::text AND u.status='active'
    AND ($2::text<>'notify_security_login' OR NOT EXISTS(
      SELECT 1 FROM notifications n WHERE n.user_id::text=u.id::text AND n.title=$2 AND n.created_at>now()-interval '24 hours'))
    RETURNING id`,[String(userId),title,userId]);
}
/** Notification failure never invalidates a successfully authenticated account. */
export async function recordSecurityNotice(userId: number | string, kind: 'login'|'password') {
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout='3s'");
    await db.query('SELECT id FROM users WHERE id::text=$1::text FOR UPDATE',[String(userId)]);
    await insertSecurityNotice(db,userId,kind);
    await db.query('COMMIT');
  } catch(error) {await db.query('ROLLBACK');throw error;}
  finally{db.release();}
}
export async function safeSecurityNotice(userId: number | string, kind: 'login'|'password') {
  try{await recordSecurityNotice(userId,kind);}
  catch{console.warn(JSON.stringify({event:'security_notification_unavailable',kind}));}
}
