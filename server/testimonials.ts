import type { Express, RequestHandler } from 'express';
import { z } from 'zod';
import { pool } from './db';
import { requireAuth } from './auth';
import { testimonialInput } from '../shared/testimonials';
const handle=(fn:RequestHandler):RequestHandler=>async(req,res,next)=>{try{await fn(req,res,next);}catch(e){if(e instanceof z.ZodError){res.status(400).json({code:'validation'});return;}next(e);}};
export function registerTestimonials(app:Express){
 app.get('/api/testimonials',handle(async(req,res)=>{
  const lang=z.enum(['ar','en']).parse(req.query.lang||'en');
  const result=await pool.query('SELECT id,name,quote,language,location FROM academy_testimonials WHERE published=true AND consent=true AND language=$1 ORDER BY id DESC LIMIT 50',[lang]);
  res.set('Cache-Control','no-store').json(result.rows);
 }));
 app.get('/api/portal/testimonials',requireAuth(['admin']),handle(async(_req,res)=>{
  res.set('Cache-Control','no-store').json((await pool.query('SELECT id,name,quote,language,location,consent,published FROM academy_testimonials ORDER BY id DESC LIMIT 200')).rows);
 }));
 app.post('/api/portal/testimonials',requireAuth(['admin']),handle(async(req,res)=>{
  const v=testimonialInput.parse(req.body);
  const r=await pool.query('INSERT INTO academy_testimonials(name,quote,language,location,consent,published) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[v.name,v.quote,v.language,v.location,v.consent,v.published]);
  res.status(201).json({id:r.rows[0].id});
 }));
 app.put('/api/portal/testimonials/:id',requireAuth(['admin']),handle(async(req,res)=>{
  const id=z.coerce.number().int().positive().parse(req.params.id),v=testimonialInput.parse(req.body);
  const r=await pool.query('UPDATE academy_testimonials SET name=$1,quote=$2,language=$3,location=$4,consent=$5,published=$6,updated_at=now() WHERE id=$7',[v.name,v.quote,v.language,v.location,v.consent,v.published,id]);
  res.status(r.rowCount?200:404).json({ok:!!r.rowCount});
 }));
 app.delete('/api/portal/testimonials/:id',requireAuth(['admin']),handle(async(req,res)=>{
  const id=z.coerce.number().int().positive().parse(req.params.id);
  const r=await pool.query('DELETE FROM academy_testimonials WHERE id=$1',[id]);
  res.status(r.rowCount?200:404).json({ok:!!r.rowCount});
 }));
}
