import { courseIdentity } from '@shared/course-identities';
type Course = { title: string; titleAr?: string | null };
const arabic: Record<string, string> = {
  'quran-reading': 'تلاوة القرآن للمبتدئين', tajweed: 'أحكام التجويد المتقدمة', hifz: 'حفظ القرآن الكريم', arabic: 'إتقان اللغة العربية',
  'basics-of-islam': 'أساسيات الإسلام', fiqh: 'الفقه الإسلامي', 'on-demand': 'دورة حسب الطلب', tafsir: 'التفسير والتدبر', hadith: 'الأحاديث النبوية',
};
export function programLabel(program: { name: string; slug: string } | undefined, language: string, courses: Course[] = []): string {
  if (!program) return '—';
  const identity = courseIdentity(program.slug) || courseIdentity(program.name);
  const course = courses.find(c => c.title === program.name || (identity && courseIdentity(c.title)?.slug === identity.slug));
  if (language.startsWith('ar')) return course?.titleAr || (identity && arabic[identity.slug]) || program.name;
  return course?.title || identity?.title || program.name;
}
