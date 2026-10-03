import { PageBackdrop } from "@/components/PageBackdrop";
import { FeatureIcon } from "@/components/FeatureIcon";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/use-language";

const plans = [
 {key:'basic',nameEn:'Basic',nameAr:'أساسية',price:9,color:'border-slate-200 dark:border-slate-700',popular:false},
 {key:'standard',nameEn:'Standard',nameAr:'معيارية',price:11,color:'border-primary',popular:true},
 {key:'premium',nameEn:'Premium',nameAr:'مميزة',price:13,color:'border-secondary',popular:false},
];

const faqs = [
  {
    qEn: "How do I choose a plan?",
    qAr: "كيف أختار الباقة المناسبة؟",
    aEn: "Send an enrollment request with your preferred plan. The academy will contact you to confirm the course, schedule, and availability.",
    aAr: "أرسل طلب تسجيل مع باقتك المفضلة، وستتواصل معك الأكاديمية لتأكيد الدورة والموعد والتوفر.",
  },
  {
    qEn: "Are lessons one-on-one?",
    qAr: "هل الحصص فردية؟",
    aEn: "Yes. Public course plans are for personal one-on-one online lessons with the academy instructor.",
    aAr: "نعم. باقات الدورات المعروضة مخصصة لحصص فردية عبر الإنترنت مع معلم الأكاديمية.",
  },
  {
    qEn: "Can I request a preferred time?",
    qAr: "هل يمكنني طلب موعد مفضل؟",
    aEn: "Yes. Include your preferred schedule in the inquiry form. The final time is confirmed based on availability.",
    aAr: "نعم. اذكر موعدك المفضل في نموذج الطلب، ويُؤكد الموعد النهائي حسب التوفر.",
  },
  {
    qEn: "How does the free trial work?",
    qAr: "كيف تعمل الحصة التجريبية المجانية؟",
    aEn: "Book a free 30-minute evaluation session. No payment required and no obligation to subscribe afterward.",
    aAr: "احجز حصة تقييمية مجانية مدتها 30 دقيقة. لا يلزم أي دفع ولا التزام بالاشتراك بعدها.",
  },
  {
    qEn: "How are online lesson details shared?",
    qAr: "كيف أحصل على تفاصيل الحصة عبر الإنترنت؟",
    aEn: "The academy confirms the online lesson details with you after reviewing your request.",
    aAr: "تؤكد الأكاديمية معك تفاصيل الحصة عبر الإنترنت بعد مراجعة طلبك.",
  },
];

export default function Pricing() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      {/* Hero */}
      <section className="academy-hero-surface pt-32 pb-16 bg-white dark:bg-slate-900 text-center"><PageBackdrop variant="pricing" />
        <div className="container-wide max-w-3xl">
          <div data-reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-6">

              <span>{t("pageUi.Pricing.Free_trial_session_included")}</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-display font-bold text-slate-900 dark:text-slate-100 mb-4">
              {t("pricing.title")}
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-400">{t("pricing.subtitle")}</p>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-20">
        <div className="container-wide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan, i) => (
              <div data-reveal
                key={plan.key}
                className={`relative bg-white dark:bg-slate-900 rounded-3xl border-2 ${plan.color} shadow-lg dark:shadow-slate-900/50 flex flex-col overflow-hidden transition-transform hover:-translate-y-1 duration-300`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-primary text-white text-center text-xs font-bold py-1.5 uppercase tracking-widest">
                    {t("pricing.most_popular")}
                  </div>
                )}

                <div className={`p-8 ${plan.popular ? "pt-10" : ""}`}>
                  <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mb-1">
                    {isRTL ? plan.nameAr : plan.nameEn}
                  </h2>
                  <p className="text-primary font-semibold mb-4">{t("experience."+plan.key+"Purpose")}</p>
                  <div className="flex items-end gap-1 mb-8">
                    <span className="text-5xl font-display font-extrabold text-slate-900 dark:text-slate-100">${plan.price}</span>
                    <span className="text-slate-400 mb-2">{t("pricing.per_month")}</span>
                  </div>

                  <Link href={`/contact?tab=enroll&plan=${encodeURIComponent(plan.nameEn)}#contact-form`}>
                    <Button
                      className={`w-full h-12 text-base font-bold rounded-xl ${
                        plan.popular
                          ? "btn-primary shadow-lg shadow-primary/20"
                          : "border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary hover:bg-primary/5"
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {t("pricing.get_started")}
                    </Button>
                  </Link>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 p-8 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-5">{t("pricing.includes")}</p>
                  <ul className="space-y-3">
                    {(t("experience."+plan.key+"Features", {returnObjects:true}) as string[]).map((f, j) => (
                      <li key={j} className="flex items-start gap-3 text-slate-700 dark:text-slate-300 text-sm">
                        <span className="academy-dot" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <p className="max-w-3xl mx-auto mt-8 text-center text-sm text-slate-600 dark:text-slate-400">{t("experience.planNote")}</p>
          <div className="mt-12 text-center">
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              {t("pageUi.Pricing.Not_sure_yet_Try_for_free_first")}
            </p>
            <Link href="/contact?tab=trial">
              <Button variant="outline" className="border-2 border-primary text-primary hover:bg-primary hover:text-white h-12 px-8 font-bold rounded-xl transition-all">
                {t("pricing.free_trial_cta")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white dark:bg-slate-900">
        <div className="container-wide max-w-3xl">
          <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100 text-center mb-12">
            {t("pricing.faq_title")}
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div data-reveal
                key={i}
                className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <FeatureIcon name="question-circle-fill" compact />
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">{isRTL ? faq.qAr : faq.qEn}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{isRTL ? faq.aAr : faq.aEn}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
