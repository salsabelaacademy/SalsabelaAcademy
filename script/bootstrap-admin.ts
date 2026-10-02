/** Explicit first-owner creation only. Never runs during startup or migration. */
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {pool} from '../server/db';
import {hashPasswordAsync} from '../server/auth';
const rl=createInterface({input:stdin,output:stdout});
try{
 const admins=await pool.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
 if(admins.rowCount)throw new Error('An admin already exists. Use the password reset flow.');
 const name=(await rl.question('Owner name: ')).trim();const email=(await rl.question('Owner email: ')).trim().toLowerCase();
 if(!name||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Invalid owner details');
 // Read password from a private file supplied by the operator; never echoed or passed as a CLI value.
 const file=process.env.ADMIN_PASSWORD_FILE;if(!file)throw new Error('Set ADMIN_PASSWORD_FILE to a private password file (chmod 600).');
 const {readFile,stat}=await import('node:fs/promises');if((await stat(file)).mode&0o077)throw new Error('Password file must be private (chmod 600).');
 const password=(await readFile(file,'utf8')).trim();if(password.length<12||password.length>128)throw new Error('Use a 12–128 character password');
 const hash=await hashPasswordAsync(password);const c=await pool.connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(730050)');if((await c.query("SELECT id FROM users WHERE role='admin'")).rowCount)throw new Error('Admin already exists');await c.query("INSERT INTO users(name,email,password_hash,role,status,email_verified_at) VALUES($1,$2,$3,'admin','active',now())",[name,email,hash]);await c.query('COMMIT');console.log('Owner account created. Delete the private password file.');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}finally{rl.close();await pool.end();}
