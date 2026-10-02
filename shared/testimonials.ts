import { z } from 'zod';
export const testimonialInput = z.object({
 name:z.string().trim().min(1).max(100),
 quote:z.string().trim().min(10).max(2000),
 language:z.enum(['en','ar']),
 location:z.string().trim().max(100).default(''),
 consent:z.boolean(),
 published:z.boolean(),
}).strict().refine(v=>!v.published||v.consent,{message:'Publication consent is required',path:['consent']});
export type Testimonial = z.infer<typeof testimonialInput> & {id:number};
