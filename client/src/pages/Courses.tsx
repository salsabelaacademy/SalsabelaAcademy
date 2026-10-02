import { PageBackdrop } from "@/components/PageBackdrop";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useCourses } from "@/hooks/use-courses";
import { CourseCard } from "@/components/CourseCard";
import { useTranslation } from "react-i18next";

function CourseCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm animate-pulse">
      <div className="h-52 bg-slate-200 dark:bg-slate-700" />
      <div className="p-6 space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        <div className="space-y-2">
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
        </div>
        <div className="flex gap-3 pt-2">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-full w-24" />
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-full w-24" />
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-20" />
          <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded-xl w-28" />
        </div>
      </div>
    </div>
  );
}

export default function Courses() {
  const { t } = useTranslation();
  const { data: courses, isLoading, isError, refetch } = useCourses();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <section className="academy-hero-surface pt-32 pb-16 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800"><PageBackdrop variant="courses" />
        <div className="container-wide text-center">
          <h1 data-reveal
            className="text-4xl lg:text-5xl font-display font-bold text-slate-900 dark:text-slate-100 mb-4"
          >
            {t("courses.explore_title")}
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t("courses.explore_subtitle")}
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container-wide">
          {isError && <div role="alert"><p>{t('restore.pageError')}</p><button className="btn-primary" onClick={()=>refetch()}>{t('restore.retry')}</button></div>}
          {!isLoading&&!isError&&!courses?.length&&<p role="status">{t('p4.empty')}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <CourseCardSkeleton key={i} />)
              : courses?.map((course, index) => (
                  <CourseCard key={course.id} course={course} index={index} />
                ))
            }
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
