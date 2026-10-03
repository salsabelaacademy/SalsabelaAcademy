import type { Express } from 'express';
import { requireAuth } from './auth';
import { pool } from './db';
import { z } from 'zod';

// Search selected display fields only. URLs, tokens and private student notes
// are never projected into the result, even when another field matches.
export function registerDashboardSearch(app: Express) {
  const windows = new Map<number, {count: number; expires: number}>();
  app.get('/api/portal/search', requireAuth(['admin', 'student']), async (req, res, next) => {
    try {
      const parsed = z.string().trim().min(2).max(160).safeParse(req.query.q);
      if (!parsed.success) return res.status(400).json({code: 'validation'});
      const user = (req as any).auth.user;
      const now = Date.now();
      windows.forEach((value,key)=>{if(value.expires<now)windows.delete(key);});
      const window = windows.get(user.id) || {count: 0, expires: now + 60_000};
      windows.set(user.id, window);
      if (++window.count > 90) { res.setHeader('Retry-After', '60'); return res.status(429).json({code:'limited'}); }
      const admin = user.role === 'admin';
      const sources = [
        `SELECT l.id,'lesson' AS kind,'lessons' AS tab,l.title AS title,concat_ws(' ',l.feedback,f.details${admin ? ',u.name,l.private_admin_notes' : ''}) AS excerpt FROM lessons l LEFT JOIN (SELECT lesson_id,string_agg(concat_ws(' ',covered,comment),' ') AS details FROM lesson_followups ${admin ? '' : 'WHERE student_id=$1'} GROUP BY lesson_id) f ON f.lesson_id=l.id ${admin ? 'JOIN users u ON u.id=l.student_id' : 'WHERE l.student_id=$1'}`,
        `SELECT m.id,'message','messages',m.subject,concat_ws(' ',s.name,r.name,m.body) FROM messages m JOIN users s ON s.id=m.sender_id JOIN users r ON r.id=m.recipient_id WHERE m.sender_id=$1 OR m.recipient_id=$1`,
        `SELECT id,'notification','notifications',title,body FROM notifications WHERE user_id=$1`,
        `SELECT a.id,'attendance','attendance',a.course,concat_ws(' ',a.status,a.notes${admin ? ',u.name' : ''}) FROM attendance_records a ${admin ? 'JOIN users u ON u.id=a.student_id' : 'WHERE a.student_id=$1'}`,
        ...(admin ? [
          `SELECT id,'student','students',name,email FROM users WHERE role='student'`,
          `SELECT id,'application','applications',name,concat_ws(' ',email,course,requested_program,learning_goals,current_experience,admin_notes) FROM platform_applications`,
          `SELECT id,'contact','contactInbox',subject,concat_ws(' ',name,email,message) FROM contact_messages`,
          `SELECT id,'post','blog',title,regexp_replace(content,'<[^>]*>',' ','g') FROM posts`,
          `SELECT a.id,'audit','audit',a.action,concat_ws(' ',u.name,a.resource) FROM (SELECT id,actor_id,action,resource FROM academy_audit ORDER BY id DESC LIMIT 200) a LEFT JOIN users u ON u.id=a.actor_id`,
        ] : [
          `SELECT e.id,'enrollment','programs',p.name,e.status FROM enrollments e JOIN programs p ON p.id=e.program_id WHERE e.student_id=$1`,
        ]),
      ];
      const normalize = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
      const tokens = normalize(parsed.data).split(/\s+/).filter(Boolean).slice(0, 8);
      if (!tokens.length || normalize(parsed.data).trim().length < 2) return res.status(400).json({code:'validation'});
      const args: unknown[] = [user.id];
      // Match all query words; literal % and _ must not become SQL wildcards.
      const fold=(expression:string)=>`translate(regexp_replace(lower(${expression}), '[ً-ٰٟ̀-ͯ]', '', 'g'),'أإآىàáâãäåèéêëìíîïòóôõöùúûüçñ','ااايaaaaaaeeeeiiiiooooouuuucn')`;
      const normalized = fold("concat_ws(' ',title,excerpt)");
      const filters = tokens.map(token => {
        args.push('%' + token.replace(/[\\%_]/g,'\\$&') + '%');
        return `${normalized} LIKE $${args.length} ESCAPE '\\'`;
      });
      args.push(tokens[0]);
      const snippetParameter=args.length;
      args.push(normalize(parsed.data));
      const result = await pool.query(`WITH records AS (${sources.join(' UNION ALL ')}) SELECT id,kind,tab,title,substring(excerpt FROM greatest(1,position($${snippetParameter} IN ${fold("excerpt")})-60) FOR 240) AS excerpt FROM records WHERE ${filters.join(' AND ')} ORDER BY CASE WHEN lower(title)=$${args.length} THEN 0 ELSE 1 END,title,id LIMIT 40`, args);
      res.setHeader('Cache-Control','private, no-store');
      res.json({results: result.rows});
    } catch (error) { next(error); }
  });
}
