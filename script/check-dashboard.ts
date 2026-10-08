import pg from 'pg';
const configured=(name:string)=>Boolean(process.env[name]?.trim());
const required=['DATABASE_URL','GEMINI_API_KEY','RESEND_API_KEY','RESEND_FROM','FRONTEND_URL'];
console.log(JSON.stringify({environment:Object.fromEntries(required.map(name=>[name,configured(name)?'configured':'missing'])),httpsOrigin:Boolean(process.env.FRONTEND_URL?.startsWith('https://'))},null,2));
if(!configured('DATABASE_URL'))process.exitCode=1;
else {
 const c=new pg.Client({connectionString:process.env.DATABASE_URL});
 try {
  await c.connect();
  const result=await c.query(`SELECT name,to_regclass('public.'||name) IS NOT NULL AS present FROM unnest($1::text[]) AS name`,[['lesson_followups','account_details','ai_request_usage','lesson_series','account_preferences','email_deliveries','lesson_report_claims']]);
  const columns=await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name IN ('read_at','request_key')");
  const trigger=await c.query("SELECT 1 FROM pg_trigger WHERE tgname='academy_single_lesson_report' AND NOT tgisinternal");
  console.log(JSON.stringify({tables:result.rows,messageColumns:columns.rows.map(r=>r.column_name),singleReportProtection:Boolean(trigger.rowCount),note:'Presence checks only. Provider credentials have not been tested.'},null,2));
  if(result.rows.some(r=>!r.present)||columns.rows.length!==2||!trigger.rowCount)process.exitCode=1;
 }catch(error){console.error(JSON.stringify({code:(error as {code?:string}).code||'database_unavailable',message:'Database diagnostic failed. No credentials or query details are printed.'}));process.exitCode=1;}finally{await c.end();}
}
