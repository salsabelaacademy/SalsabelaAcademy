import pg from 'pg';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {recoverCatalogue} from '../server/catalogue-recovery';
const apply=process.argv.includes('--apply');
if(!process.env.DATABASE_URL)throw new Error('Set DATABASE_URL in your private environment before running this command.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try{
 await client.query('BEGIN');
 // Existing tables only. No startup DDL and no change to users, lessons or applications.
 if(apply)await client.query('LOCK TABLE courses,programs IN SHARE ROW EXCLUSIVE MODE');
 const result=await recoverCatalogue(client,apply,async snapshot=>{
  const directory=resolve(process.env.CATALOG_BACKUP_DIR||'backups');await mkdir(directory,{recursive:true,mode:0o700});
  const path=resolve(directory,'catalogue-before-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json');
  await writeFile(path,JSON.stringify(snapshot,null,2),{flag:'wx',mode:0o600});console.log('Catalogue backup saved:',path);
 });
 await client.query(apply?'COMMIT':'ROLLBACK');
 console.log(JSON.stringify(result,null,2));
 if(!apply)console.log('Preview only. To restore the nine original courses: npm run catalog:restore');
}catch(error){await client.query('ROLLBACK');console.error('Catalogue recovery stopped; no partial course changes committed.');throw error;}
finally{await client.end();}
