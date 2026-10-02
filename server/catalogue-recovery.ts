import {originalCourses} from '../shared/original-courses';
import {courseIdentity} from '../shared/course-identities';
type Connection={query:(sql:string,values?:any[])=>Promise<any>};
const columns={title:'title',titleAr:'title_ar',description:'description',descriptionAr:'description_ar',imageUrl:'image_url',imageUrlAr:'image_url_ar',duration:'duration',durationAr:'duration_ar',classDetails:'class_details',classDetailsAr:'class_details_ar',price:'price',level:'level',levelAr:'level_ar'};
/** Caller owns transaction and table locks. Pure preview, explicit apply; never used at startup. */
export async function recoverCatalogue(client:Connection,apply=false,beforeWrite?:(snapshot:unknown)=>Promise<void>){
 const courses=(await client.query('SELECT * FROM courses ORDER BY id')).rows;
 const programs=(await client.query('SELECT * FROM programs ORDER BY id')).rows;
 const actions=originalCourses.map(original=>{
  const identity=courseIdentity(original.title)!;
  const exact=courses.filter((c:any)=>c.title===original.title);
  const aliases=courses.filter((c:any)=>courseIdentity(c.title)?.slug===identity.slug);
  if(exact.length>1||(!exact.length&&aliases.length>1))throw new Error(`Ambiguous existing course: ${original.title}; review duplicate rows before restoring.`);
  const existing=exact[0]||aliases[0];
  const related=programs.filter((p:any)=>courseIdentity(p.name)?.slug===identity.slug||courseIdentity(p.slug)?.slug===identity.slug);
  if(related.length>1)throw new Error(`Ambiguous existing program: ${original.title}; review before restoring.`);
  return {title:original.title,action:exact.length?'preserve':existing?'restore-original-fields':'insert',id:existing?.id,programAction:related.length?'preserve':'insert',original,slug:identity.slug};
 });
 const summary=actions.map(({original,slug,...a})=>a);
 if(!apply)return {applied:false,actions:summary,existingCourses:courses.length};
 if(beforeWrite)await beforeWrite({createdAt:new Date().toISOString(),courses,programs});
 let courseId=Math.max(0,...courses.map((c:any)=>Number(c.id)));
 let programId=Math.max(0,...programs.map((p:any)=>Number(p.id)));
 for(const a of actions){
  const fields=Object.keys(columns) as (keyof typeof columns)[];
  const values=fields.map(k=>a.original[k]??null);
  if(a.action==='insert')await client.query(`INSERT INTO courses(id,${Object.values(columns).join(',')}) VALUES($1,${fields.map((_,i)=>'$'+(i+2)).join(',')})`,[++courseId,...values]);
  else if(a.action==='restore-original-fields')await client.query(`UPDATE courses SET ${fields.map((k,i)=>columns[k]+'=$'+(i+1)).join(',')} WHERE id=$${fields.length+1}`,[...values,a.id]);
  if(a.programAction==='insert'){
   if(programs.some((p:any)=>p.slug===a.slug))throw new Error('Program slug conflict: '+a.slug);
   await client.query('INSERT INTO programs(id,name,slug,is_public) VALUES($1,$2,$3,true)',[++programId,a.title,a.slug]);
  }
 }
 // Explicit IDs preserve existing links; advance sequences without lowering them.
 await client.query("SELECT setval(pg_get_serial_sequence('courses','id'),GREATEST((SELECT last_value FROM courses_id_seq),(SELECT max(id) FROM courses)),true)");
 await client.query("SELECT setval(pg_get_serial_sequence('programs','id'),GREATEST((SELECT last_value FROM programs_id_seq),(SELECT max(id) FROM programs)),true)");
 return {applied:true,actions:summary,courseCount:(await client.query('SELECT count(*)::int AS count FROM courses')).rows[0].count};
}
