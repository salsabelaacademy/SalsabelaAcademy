/** Explicit additive upgrade for an already migrated Phase 4 database.
 * Does not run at application startup. Back up before running. */
import pg from "pg";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (process.env.NODE_ENV === "production" && process.env.CONFIRM_PHASE5_MIGRATION !== "yes") throw new Error("Back up the database, review SQL, then set CONFIRM_PHASE5_MIGRATION=yes for an explicit production upgrade");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(730035)");
  const baseline = await client.query("SELECT to_regclass('public.lessons') AS lessons,to_regclass('public.enrollments') AS enrollments,to_regclass('public.academy_settings') AS integration_jobs");
  if (!baseline.rows[0].lessons || !baseline.rows[0].enrollments || !baseline.rows[0].integration_jobs) throw new Error("Phase 4 schema missing. Use the fresh migration workflow instead.");
  await client.query("CREATE TABLE IF NOT EXISTS academy_manual_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const name of ["0005_phase5_indexes"]) {
    const source = await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), "utf8");
    const checksum = createHash("sha256").update(source).digest("hex");
    const old = await client.query("SELECT checksum FROM academy_manual_migrations WHERE name=$1", [name]);
    if (old.rowCount) {
      if (old.rows[0].checksum !== checksum) throw new Error(`Changed migration: ${name}. Review manually.`);
      continue;
    }
    await client.query(source);
    await client.query("INSERT INTO academy_manual_migrations(name,checksum) VALUES($1,$2)", [name, checksum]);
    console.log(`Applied ${name}`);
  }
  await client.query("COMMIT");
  console.log("Phase 5 additive upgrade complete. Existing academy data retained.");
} catch (e) { await client.query("ROLLBACK"); throw e; }
finally { await client.end(); }
