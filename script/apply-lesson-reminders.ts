import pg from "pg";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { safeDatabaseIssue } from "../server/service-errors";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (process.env.NODE_ENV === "production" && process.env.CONFIRM_DASHBOARD_MIGRATION !== "yes")
  throw new Error("Back up your database and set CONFIRM_DASHBOARD_MIGRATION=yes");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  await db.connect();
  await db.query("BEGIN");
  await db.query("SET LOCAL lock_timeout='5s'");
  await db.query("SET LOCAL statement_timeout='30s'");
  await db.query("SELECT pg_advisory_xact_lock(730040)");
  const prerequisite = (await db.query(`SELECT
    to_regclass('public.users') IS NOT NULL AND
    to_regclass('public.notifications') IS NOT NULL AND
    to_regclass('public.account_preferences') IS NOT NULL AND
    to_regclass('public.email_deliveries') IS NOT NULL AND
    EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
      JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE t.tgrelid=to_regclass('public.notifications') AND NOT t.tgisinternal
      AND t.tgenabled <> 'D' AND p.proname='academy_email_outbox'
      AND n.nspname='public') AS ready`)).rows[0];
  if (!prerequisite?.ready) throw Object.assign(new Error(), { code: "PRE01" });
  const name = "0015_lesson_reminders";
  const source = await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), "utf8");
  const checksum = createHash("sha256").update(source).digest("hex");
  await db.query("CREATE TABLE IF NOT EXISTS public.academy_manual_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())");
  const prior = (await db.query("SELECT checksum FROM public.academy_manual_migrations WHERE name=$1", [name])).rows[0];
  if (prior && prior.checksum !== checksum) throw Object.assign(new Error(), { code: "CHK01" });
  if (!prior) {
    await db.query(source);
    await db.query("INSERT INTO public.academy_manual_migrations(name,checksum) VALUES($1,$2)", [name, checksum]);
  }
  await db.query("COMMIT");
  console.log("Lesson reminders migration complete. Existing rows retained.");
} catch (error) {
  try { await db.query("ROLLBACK"); } catch { /* Connection may not have opened. */ }
  console.error(JSON.stringify({ event: "lesson_reminder_migration_failed", ...safeDatabaseIssue(error, "migration") }));
  process.exitCode = 1;
} finally {
  await db.end();
}
