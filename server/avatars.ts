import type { Express, RequestHandler } from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import { requireAuth } from './auth';
import { pool } from './db';

/** Small, re-encoded avatars live in PostgreSQL and survive ephemeral hosts. */
export function registerAvatars(app: Express, limit: RequestHandler) {
  app.put('/api/portal/avatar', requireAuth(['admin', 'student']), limit, async (req, res, next) => {
    const parsed = z.object({ image: z.string().max(240000) }).strict().safeParse(req.body);
    const match = parsed.success && /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(parsed.data.image);
    if (!match) return res.status(400).json({ code: 'avatarInvalid' });
    let image: Buffer;
    try {
      const source = Buffer.from(match[2], 'base64');
      if (source.length > 180000 || !source.length) throw new Error('size');
      const rasterSignature = source.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
        || (source[0] === 255 && source[1] === 216 && source[2] === 255)
        || (source.toString('ascii', 0, 4) === 'RIFF' && source.toString('ascii', 8, 12) === 'WEBP');
      if (!rasterSignature) throw new Error('format');
      const decoder = sharp(source, { limitInputPixels: 4000000, failOn: 'warning' });
      const metadata = await decoder.metadata();
      if (!['png', 'jpeg', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) !== 1) throw new Error('format');
      image = await decoder.rotate().resize(256, 256, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
      if (image.length > 64000) throw new Error('size');
    } catch { return res.status(400).json({ code: 'avatarInvalid' }); }
    try {
      await pool.query('UPDATE users SET avatar_url=$1,updated_at=now() WHERE id=$2', ['data:image/webp;base64,' + image.toString('base64'), (req as any).auth.user.id]);
      res.json({ ok: true });
    } catch (error) { next(error); }
  });
  app.delete('/api/portal/avatar', requireAuth(['admin', 'student']), limit, async (req, res, next) => {
    try {
      await pool.query('UPDATE users SET avatar_url=NULL,updated_at=now() WHERE id=$1', [(req as any).auth.user.id]);
      res.json({ ok: true });
    } catch (error) { next(error); }
  });
}
