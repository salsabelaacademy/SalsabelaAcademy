import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
if(process.env.NODE_ENV==='production'&&process.env.CONFIRM_ACCOUNT_MIGRATION!=='yes')throw new Error('Back up your database and set CONFIRM_ACCOUNT_MIGRATION=yes');
const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
try{
 await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(730040)');
 const schema=(await c.query("SELECT to_regclass('public.lesson_followups') AS followup")).rows[0];
 if(!schema.followup)throw new Error('Apply the earlier lesson follow-up migration first.');
 await c.query('CREATE TABLE IF NOT EXISTS academy_manual_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
 const name='0009_account_details',source=await readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8'),checksum=createHash('sha256').update(source).digest('hex');
 const prior=(await c.query('SELECT checksum FROM academy_manual_migrations WHERE name=$1',[name])).rows[0];
 if(prior&&prior.checksum!==checksum)throw new Error('Migration checksum changed. Review before proceeding.');
 if(!prior){await c.query(source);await c.query('INSERT INTO academy_manual_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);}
 await c.query('COMMIT');console.log('Private account details migration complete. Existing data retained.');
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
