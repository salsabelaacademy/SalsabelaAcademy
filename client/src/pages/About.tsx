import { PageBackdrop } from "@/components/PageBackdrop";
import { FeatureIcon } from "@/components/FeatureIcon";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/use-language";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function About() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      {/* Hero */}
      <section className="academy-hero-surface pt-32 pb-20 relative overflow-hidden">
        <PageBackdrop variant="about" />
        <div className="container-wide relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div data-reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 text-secondary text-sm font-semibold mb-6">

                <span>{t("pageUi.About.Direct_One_on_One_Learning")}</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-display font-bold text-slate-900 dark:text-slate-100 mb-4 leading-tight">
                {t("polish.aboutTitle")}
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
                {t("polish.aboutSubtitle")}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/contact?tab=trial">
                  <Button className="btn-primary h-12 px-6">
                    {t("pageUi.About.Book_Free_Trial")}
                  </Button>
                </Link>
                <Link href="/courses">
                  <Button variant="outline" className="h-12 px-6 border-2 border-slate-200 dark:border-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary rounded-xl">
                    {t("pageUi.About.Explore_Courses")}
                  </Button>
                </Link>
              </div>
            </div>

            <div data-reveal>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-2xl opacity-60" />
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800">
                  <img
                    width={900} height={900} src={isRTL ? "/images/about-ar.webp" : "/images/about-en.webp"}
                    alt={t("pageUi.About.Salsabela_Academy")}
                    className="w-full h-80 lg:h-96 object-cover"
                  />
                </div>
                <div className="absolute -bottom-6 -start-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl shadow-xl z-10">
                  <div className="flex items-center gap-3">
                    <span className="academy-monogram" aria-hidden="true">{isRTL ? "١:١" : "1:1"}</span>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t("pageUi.About.Personal_guidance")}</p>
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{t("pageUi.About.Online_one_on_one_lesson")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Academy Description */}
      <section className="py-20 bg-slate-50 dark:bg-slate-950">
        <div className="container-wide">
          <div className="max-w-3xl mx-auto">
            <div className="text-center">
              <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100 mb-2">
                {t("about.academy_name")}
              </h2>
              <p className="text-primary font-semibold mb-6">{t("polish.aboutTagline")}</p>
              <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-6">
                {t("polish.aboutIntro")}
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed">
                {t("polish.aboutMission")}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Teaching Methodology */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="container-wide">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100 mb-4">
              {t("polish.methodTitle")}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { k: "method_1" },
              { k: "method_2" },
              { k: "method_3" },
              { k: "method_4" },
            ].map((m, i) => (
              <div data-reveal
                key={m.k}
                className="flex gap-4 p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-primary/20 hover:shadow-md transition-all"
              >
                <FeatureIcon name={(["book-half", "person-video3", "calendar2-week", "journal-bookmark-fill"] as const)[i]} compact />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">
                    {t(`polish.${m.k}_title`)}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                    {t(`polish.${m.k}_desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-slate-50 dark:bg-slate-950">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { key: "instructor_guidance", descKey: "instructor_guidance_desc" },
              { key: "quality_edu", descKey: "quality_edu_desc" },
              { key: "student_centered", descKey: "student_centered_desc" },
            ].map((card, i) => (
              <div data-reveal
                key={card.key}
                className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 text-center hover:shadow-md hover:border-primary/20 transition-all"
              >
                <FeatureIcon name={(["person-video3", "patch-check-fill", "heart-fill"] as const)[i]} />
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3">{t(`about.${card.key}`)}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{t(`about.${card.descKey}`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-primary to-primary/80">
        <div className="container-wide text-center">
          <h2 className="text-3xl font-display font-bold text-white mb-4">
            {t("pageUi.About.Ready_to_Start_Your_Journey")}
          </h2>
          <p className="text-white/80 mb-8 text-lg">
            {t("pageUi.About.Book_your_free_evaluation_session_today")}
          </p>
          <Link href="/contact?tab=trial">
            <Button className="bg-white text-primary hover:bg-white/90 h-12 px-8 text-base font-bold rounded-xl shadow-lg">
              {t("pageUi.About.Book_Free_Trial_Now")}
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
