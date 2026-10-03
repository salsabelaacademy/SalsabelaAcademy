import { z } from 'zod';
export const dateOfBirth = z.string().refine(value=>{
 if(value==='')return true;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1900-01-01'||value>new Date().toISOString().slice(0,10))return false;
 const date=new Date(value+'T00:00:00Z');return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}).transform(value=>value||null);
