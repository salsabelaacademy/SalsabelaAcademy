import { FeatureIcon } from "@/components/FeatureIcon";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { useCourses } from "@/hooks/use-courses";
import { CourseCard } from "@/components/CourseCard";
import { InquiryForm } from "@/components/InquiryForm";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/use-language";
import { HomeContent } from "@/components/HomeContent";


export default function Home() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { data: courses, isLoading } = useCourses();


  const featuredCourses = courses?.slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/images/home-mosque.webp')] bg-cover bg-center opacity-5 dark:opacity-10"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/50 to-slate-50 dark:from-slate-950/0 dark:via-slate-950/50 dark:to-slate-950"></div>

        <div className="container-wide relative z-10 max-w-5xl text-center">
          <div data-reveal
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
              <span>{t("experience.eyebrow")}</span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-display font-bold text-slate-900 dark:text-slate-100 leading-[1.1] mb-6">
              {t("experience.hero")}
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed mb-8 max-w-2xl mx-auto">
              {t("experience.heroBody")}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/apply">
                <Button className="btn-primary h-14 px-8 text-lg">
                  {t("experience.cta")}
                </Button>
              </Link>

            </div>

          </div>

        </div>
      </section>


      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="container-wide">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-display font-bold text-slate-900 dark:text-slate-100 mb-4">
              {t("experience.why")}
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              {t("experience.whyBody")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1,2,3].map(n => ({title:t('experience.feature'+n),description:t('experience.feature'+n+'Body')})).map((feature, i) => (
              <div data-reveal
                key={i}
                className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all group"
              >
                <FeatureIcon number={i + 1} />
                <h3 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100 mb-3">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Courses Preview */}
      <section className="py-20 bg-slate-50 dark:bg-slate-950 pattern-grid">
        <div className="container-wide">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-slate-900 dark:text-slate-100 mb-4">{t("courses.title")}</h2>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                {t("pageUi.Home.Explore_the_academy_courses_and_choose_your_learning_path")}
              </p>
            </div>
            <Link href="/courses">
              <Button variant="ghost" className="hidden sm:flex text-primary hover:text-primary hover:bg-primary/10">
                {t("pageUi.Home.View_All_Courses")}{" "}
                <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180 mr-1" : "ml-1"}`} />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {featuredCourses?.map((course, index) => (
                <CourseCard key={course.id} course={course} index={index} />
              ))}
            </div>
          )}

          <div className="mt-8 text-center sm:hidden">
            <Link href="/courses">
              <Button variant="outline" className="w-full dark:border-slate-700 dark:text-slate-300">
                {t("pageUi.Home.View_All_Courses")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <HomeContent />

      {/* CTA / Form Section */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="container-wide">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-display font-bold text-slate-900 dark:text-slate-100 mb-6">
                {t("pageUi.Home.Start_Your_Spiritual_Journey_Today")}
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                {t("pageUi.Home.Start_with_a_learning_plan_suited_to_your_level_and_goals_Your_fi")}
              </p>

              <ul className="space-y-4 mb-8">
                {[
                  t("pageUi.Home.Free_evaluation_session"),
                  t("pageUi.Home.Suitable_for_women_children_men"),
                  t("pageUi.Home.Monthly_progress_reports"),
                  t("pageUi.Home.A_plan_tailored_to_your_level")
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-700 dark:text-slate-300 font-medium">
                    <span className="academy-dot" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-2xl opacity-50"></div>
              <div className="relative">
                <InquiryForm />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
