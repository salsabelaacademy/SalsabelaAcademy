import {courseArtwork} from '../shared/course-artwork';
import {storage} from './storage';
import {courseIdentity} from '../shared/course-identities';
import type {Course} from '../shared/schema';
function artwork(value:string):string {
 if(courseArtwork[value])return courseArtwork[value];
 if(value?.startsWith('/images/')&&!value.includes('..'))return value;
 try {const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}
 return '/images/hero-en.webp';
}
/** Publish the owner's complete persisted catalogue. Never seed or substitute demo courses. */
export async function publicCourses():Promise<Course[]> {
 return (await storage.getCourses()).map(c=>({...c,imageUrl:artwork(c.imageUrl),imageUrlAr:artwork(c.imageUrlAr||c.imageUrl)}));
}
export async function resolvePublicCourse(id:string):Promise<Course|undefined>{
 const courses=await publicCourses();
 if(/^\d{1,10}$/.test(id))return courses.find(c=>c.id===Number(id));
 const alias=courseIdentity(id);
 return alias?courses.find(c=>courseIdentity(c.title)?.slug===alias.slug):undefined;
}
