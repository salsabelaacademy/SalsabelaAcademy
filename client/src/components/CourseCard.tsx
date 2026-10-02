import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Course } from "@shared/schema";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/use-language";

interface CourseCardProps {
  course: Course;
  index?: number;
}

export function CourseCard({ course }: CourseCardProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const title       = isRTL && course.titleAr       ? course.titleAr       : course.title;
  const description = isRTL && course.descriptionAr ? course.descriptionAr : course.description;
  const level       = isRTL && course.levelAr        ? course.levelAr       : course.level;
  const duration    = isRTL && course.durationAr     ? course.durationAr    : course.duration;
  const imageUrl    = isRTL && course.imageUrlAr     ? course.imageUrlAr    : course.imageUrl;

  return (
    <div data-reveal
      className="group bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300 flex flex-col h-full"
    >
      <div className="relative h-48 overflow-hidden">
        <img loading="lazy" decoding="async" width={640} height={400}
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
        />
        <div className={`absolute top-4 ${isRTL ? "left-4" : "right-4"} bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-primary shadow-sm`}>
          {level}
        </div>
      </div>

      <div className="p-6 flex flex-col flex-grow text-start">
        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-3">
          <div className="flex items-center gap-1">

            <span>{duration}</span>
          </div>
          <div className="flex items-center gap-1">

            <span>{t("pageUi.CourseCard.1_on_1")}</span>
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 font-display group-hover:text-primary transition-colors">
          {title}
        </h3>

        <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2 mb-6 flex-grow">
          {description}
        </p>

        <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">{t("courses.tuition")}</span>
              <p className="text-lg font-bold text-primary">
                {isRTL && course.price === "Based on package" ? "حسب الباقة" : course.price}
              </p>
            </div>
            <Link href={`/contact?tab=enroll&course=${encodeURIComponent(course.title)}`}>
              <Button variant="ghost" className="text-slate-900 dark:text-slate-100 hover:text-primary hover:bg-primary/5 p-0 h-auto font-medium">
                {t("courses.enroll")} <ArrowRight className={`w-4 h-4 ${isRTL ? "mr-2 rotate-180" : "ml-2"}`} />
              </Button>
            </Link>
          </div>

          <Link href={`/courses/${course.id}`} className="w-full">
            <Button variant="outline" className="w-full border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all">
              {t("courses.details")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
