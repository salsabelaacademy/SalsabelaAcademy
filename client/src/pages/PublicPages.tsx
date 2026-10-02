import { PageBackdrop } from "@/components/PageBackdrop";
import {useTranslation} from 'react-i18next';
import {Link} from 'wouter';
import {PublicShell} from '@/components/PublicShell';
import {courseCatalog} from '@shared/course-catalog';
import {useCourses} from '@/hooks/use-courses';
import {CourseCard} from '@/components/CourseCard';
export const approvedPrograms=courseCatalog.map(c=>c.program);
export const programKeys=courseCatalog.map(c=>c.key);
export function ProgramCards(){const {data=[]}=useCourses();return <div className="p4-grid">{data.map(course=><CourseCard key={course.id} course={course}/>)}</div>}
export default function PublicPage(){const {t}=useTranslation();return <PublicShell><section className="academy-hero-surface restore-page-hero"><PageBackdrop variant="journey" /><div className="container-wide"><p className="p4-eyebrow">{t('experience.eyebrow')}</p><h1>{t('experience.howTitle')}</h1><p>{t('experience.howIntro')}</p><Link className="p4-button" href="/apply">{t('experience.cta')}</Link></div></section><section className="p4-section"><div className="how-steps">{[1,2,3,4].map(n=><article data-reveal className="p4-card" key={n}><span className="p4-step" aria-hidden="true">{n}</span><h2>{t('experience.step'+n)}</h2><p>{t('experience.step'+n+'Body')}</p></article>)}</div><aside className="p4-card how-help"><h2>{t('experience.howHelp')}</h2><p>{t('experience.howHelpBody')}</p><div className="p4-row"><Link className="p4-button" href="/login">{t('p4.login')}</Link><Link className="p4-text-link" href="/contact">{t('nav.contact')}</Link></div></aside></section></PublicShell>}
