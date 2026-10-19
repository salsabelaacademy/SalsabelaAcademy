import pg from "pg";
import { checkMessageStorage, repairMessageSequence } from "../server/message-storage-check";
import { safeDatabaseIssue } from "../server/service-errors";
const repair = process.argv.includes("--repair-sequences");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 15000 });
try {
  if (!process.env.DATABASE_URL) throw Object.assign(Error(), { code: "ENV00" });
  await db.connect();
  const connection = { query: (sql: string, args?: any[]) => db.query(sql, args) };
  for (let attempt=0; attempt<5; attempt++) {
    const result = await checkMessageStorage(connection, true);
    console.log(JSON.stringify({event:"message_storage_check",...result}));
    if (result.ok) break;
    if (!repair || !result.issue || !(await repairMessageSequence(connection,result.issue))) { process.exitCode=1; break; }
    console.log(JSON.stringify({event:"message_sequence_advanced",table:result.issue.table}));
    if (attempt===4) process.exitCode=1;
  }
} catch (error) {
  console.error(JSON.stringify({event:"message_storage_check_failed",...safeDatabaseIssue(error,"connection_or_repair")}));process.exitCode=1;
} finally { await db.end(); }
