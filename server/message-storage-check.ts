import { randomUUID } from "node:crypto";
import { safeDatabaseIssue, missingRoutineInfo } from "./service-errors";
export type SqlConnection = { query: (sql: string, values?: any[]) => Promise<any> };
export type StorageCheck = { ok: boolean; rolledBack: true; issue?: ReturnType<typeof safeDatabaseIssue> };
/** Exercise the same write and trigger chain without committing or contacting a provider. */
export async function checkMessageStorage(db: SqlConnection, includeRoutineMetadata = false): Promise<StorageCheck> {
  let stage = "begin";
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL statement_timeout='10s'");
    stage = "recipient";
    const users = (await db.query("SELECT id,name,role FROM users WHERE status='active' AND role IN ('admin','student') ORDER BY id")).rows;
    const admin = users.find((u: any) => u.role === "admin"), student = users.find((u: any) => u.role === "student");
    if (!admin || !student) return { ok: false, rolledBack: true, issue: { stage, code: "active_accounts_required", table: undefined, column: undefined, constraint: undefined } };
    stage = "rate_limit";
    await db.query("INSERT INTO ai_request_usage(key,count,expires_at) VALUES($1,1,now()+interval '1 minute')", ["storage-check:" + randomUUID()]);
    stage = "notification_read";
    const previous = (await db.query("SELECT COALESCE(max(id),0) AS id FROM notifications WHERE user_id=$1", [student.id])).rows[0].id;
    stage = "message_insert";
    await db.query("INSERT INTO messages(sender_id,recipient_id,subject,body,request_key) VALUES($1,$2,$3,$4,$5) RETURNING id", [admin.id, student.id, "Academy storage check", "Rollback-only storage check", randomUUID()]);
    stage = "notification_pipeline";
    const notice = (await db.query("SELECT id FROM notifications WHERE user_id=$1 AND id>$2 AND title='notify_message' ORDER BY id DESC LIMIT 1", [student.id, previous])).rows[0];
    if (!notice) return { ok: false, rolledBack: true, issue: { stage, code: "notification_pipeline_missing", table: undefined, column: undefined, constraint: undefined } };
    stage = "email_pipeline";
    const preference = (await db.query("SELECT email_updates FROM account_preferences WHERE user_id=$1", [student.id])).rows[0];
    const queued = (await db.query("SELECT id FROM email_deliveries WHERE notification_id=$1", [notice.id])).rows.length;
    if (preference?.email_updates !== false && !queued) return { ok: false, rolledBack: true, issue: { stage, code: "email_pipeline_missing", table: undefined, column: undefined, constraint: undefined } };
    stage = "deferred_constraints";
    await db.query("SET CONSTRAINTS ALL IMMEDIATE");
    return { ok: true, rolledBack: true };
  } catch (error) {
    return { ok: false, rolledBack: true, issue: { ...safeDatabaseIssue(error, stage),
      ...(includeRoutineMetadata ? missingRoutineInfo(error) : {}) } };
  } finally {
    await db.query("ROLLBACK");
  }
}
/** Only repair a catalog-verified single-column ID primary-key collision, never a request-key conflict. */
export async function repairMessageSequence(db: SqlConnection, issue: NonNullable<StorageCheck["issue"]>) {
  const tables = ["messages", "notifications", "email_deliveries", "push_deliveries"];
  if (issue.code !== "23505" || !issue.table || !issue.constraint || !tables.includes(issue.table)) return false;
  await db.query("BEGIN");
  try {
    await db.query("SET LOCAL lock_timeout='5s'");
    const primary = (await db.query(`SELECT pg_get_serial_sequence(format('%I.%I',n.nspname,t.relname),'id') AS sequence
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE c.contype='p' AND c.conname=$1 AND t.relname=$2 AND n.nspname='public'
      AND c.conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=t.oid AND attname='id')]::smallint[]`, [issue.constraint, issue.table])).rows[0];
    if (!primary?.sequence) { await db.query("ROLLBACK"); return false; }
    const metadata = (await db.query("SELECT seqincrement::text AS increment,seqmax::text AS maximum FROM pg_sequence WHERE seqrelid=$1::regclass", [primary.sequence])).rows[0];
    if (metadata?.increment !== "1") { await db.query("ROLLBACK"); return false; }
    await db.query(`LOCK TABLE public."${issue.table}" IN SHARE ROW EXCLUSIVE MODE`);
    const highest = BigInt((await db.query(`SELECT COALESCE(max(id),0)::text AS id FROM public."${issue.table}"`)).rows[0].id);
    const last = BigInt((await db.query("SELECT pg_sequence_last_value($1::regclass)::text AS value", [primary.sequence])).rows[0].value || "0");
    const safeValue = highest > last ? highest : last;
    if (safeValue < BigInt(1) || safeValue >= BigInt(metadata.maximum)) { await db.query("ROLLBACK"); return false; }
    await db.query("SELECT setval($1::regclass,$2::bigint,true)", [primary.sequence, safeValue.toString()]);
    await db.query("COMMIT");
    return true;
  } catch (error) { await db.query("ROLLBACK"); throw error; }
}
