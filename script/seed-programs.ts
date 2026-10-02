import { db, pool } from "../server/db";
import { programs } from "../shared/schema";
import { eq } from "drizzle-orm";

const catalog = [
  ["Qur’an Reading & Recitation", "quran-reading-recitation"],
  ["Tajweed & Correction", "tajweed-correction"],
  ["Arabic Language", "arabic-language"],
] as const;

for (const [name, slug] of catalog) {
  const existing = await db.select().from(programs).where(eq(programs.slug, slug));
  if (!existing.length) await db.insert(programs).values({ name, slug, isPublic: true });
}
await pool.end();