/** Editorial course content. These are not enrollment records or claimed statistics. */
export const courseCatalog = [
  { slug: 'quran-reading', key: 'quran', program: 'Qur’an Reading & Recitation', icon: 'book', legacyTitles: ['Quran Reading for Beginners', 'Qur’an Reading & Recitation', 'Quran Reading & Recitation'] },
  { slug: 'tajweed', key: 'tajweed', program: 'Tajweed & Correction', icon: 'audio', legacyTitles: ['Advanced Tajweed Rules', 'Tajweed & Correction'] },
  { slug: 'arabic-language', key: 'arabicProgram', program: 'Arabic Language', icon: 'language', legacyTitles: ['Arabic Language Mastery', 'Arabic Language'] },
] as const;
export type PublicCourse = (typeof courseCatalog)[number] & {imageUrl?:string;imageUrlAr?:string};
export function findCourse(slug: string) { return courseCatalog.find(c => c.slug === slug); }
export function courseFromLegacyTitle(title: string) { return courseCatalog.find(c => (c.legacyTitles as readonly string[]).includes(title)); }
