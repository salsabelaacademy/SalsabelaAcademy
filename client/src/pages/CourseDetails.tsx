import { PageBackdrop } from "@/components/PageBackdrop";
import {useEffect} from "react";
import {applyMetadata} from "@/components/Seo";
import {pageMetadata} from "@shared/seo";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useCourse } from "@/hooks/use-courses";
import { useParams, Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/use-language";

const courseExtras: Record<string, {
  featuresEn: string[];
  featuresAr: string[];
  whoForEn: string;
  whoForAr: string;
  outcomesEn: string[];
  outcomesAr: string[];
}> = {
  "Quran Reading for Beginners": {
    featuresEn: ["Proper Makharij (pronunciation) training", "Tajweed rules from scratch", "Memorization techniques", "Weekly recitation review"],
    featuresAr: ["تدريب على المخارج الصحيحة", "أحكام التجويد من البداية", "تقنيات الحفظ", "مراجعة أسبوعية للتلاوة"],
    whoForEn: "Ideal for beginners and anyone looking to improve their Quran recitation with correct Tajweed.",
    whoForAr: "مثالي للمبتدئين ولكل من يريد تحسين تلاوته للقرآن الكريم بالتجويد الصحيح.",
    outcomesEn: ["Read the Quran fluently", "Apply basic Tajweed rules", "Recite with confidence", "Build a daily recitation habit"],
    outcomesAr: ["قراءة القرآن بطلاقة", "تطبيق أحكام التجويد الأساسية", "التلاوة بثقة", "بناء عادة تلاوة يومية"],
  },
  "Advanced Tajweed Rules": {
    featuresEn: ["Deep dive into all Tajweed rules", "Noon Sakinah & Tanween", "Rules of Madd (elongation)", "Live correction with the academy instructor"],
    featuresAr: ["تعمق في جميع أحكام التجويد", "أحكام النون الساكنة والتنوين", "أحكام المد", "تصحيح مباشر مع معلم الأكاديمية"],
    whoForEn: "For students who can already read Arabic and want to master correct Quran recitation at an advanced level.",
    whoForAr: "للطلاب الذين يستطيعون القراءة العربية ويريدون إتقان التلاوة الصحيحة على مستوى متقدم.",
    outcomesEn: ["Develop advanced Tajweed knowledge", "Improve recitation fluency", "Identify and self-correct mistakes", "Build a consistent practice routine"],
    outcomesAr: ["تطوير المعرفة المتقدمة بالتجويد", "تحسين طلاقة التلاوة", "تحديد الأخطاء وتصحيحها ذاتياً", "بناء روتين منتظم للتدريب"],
  },
  "Quran Memorization (Hifz)": {
    featuresEn: ["Structured memorization plan", "Daily revision sessions", "Sabaq & Sabqi system", "Monthly Hifz assessment"],
    featuresAr: ["خطة حفظ منظمة", "جلسات مراجعة يومية", "نظام السبق والسبقي", "تقييم حفظ شهري"],
    whoForEn: "For dedicated students committed to memorizing the Holy Quran at their own pace with expert guidance.",
    whoForAr: "للطلاب المخلصين الملتزمين بحفظ القرآن الكريم بالسرعة التي تناسبهم تحت إشراف متخصص.",
    outcomesEn: ["Memorize selected Surahs", "Build strong revision habits", "Progress towards full Hifz", "Strengthen your bond with the Quran"],
    outcomesAr: ["حفظ السور المختارة", "بناء عادات مراجعة قوية", "التقدم نحو الحفظ الكامل", "تعزيز الارتباط بالقرآن الكريم"],
  },
  "Arabic Language Mastery": {
    featuresEn: ["Modern Standard Arabic (MSA)", "Speaking, reading & writing", "Grammar & vocabulary building", "Conversational practice sessions"],
    featuresAr: ["اللغة العربية الفصحى", "المحادثة والقراءة والكتابة", "بناء القواعد والمفردات", "جلسات المحادثة التطبيقية"],
    whoForEn: "For anyone wanting to learn Arabic from scratch or improve their existing level for daily use or Quran understanding.",
    whoForAr: "لكل من يريد تعلم العربية من الصفر أو تحسين مستواه الحالي للاستخدام اليومي أو فهم القرآن.",
    outcomesEn: ["Hold everyday conversations", "Read and understand Arabic texts", "Write correctly in Arabic", "Understand Quran vocabulary"],
    outcomesAr: ["إجراء محادثات يومية", "قراءة وفهم النصوص العربية", "الكتابة الصحيحة بالعربية", "فهم مفردات القرآن الكريم"],
  },
  "Basics of Islam": {
    featuresEn: ["The five pillars of Islam explained", "Islamic beliefs (Aqeedah) fundamentals", "Daily worship: prayer, fasting & Zakat", "Islamic etiquette and character building"],
    featuresAr: ["شرح أركان الإسلام الخمسة", "أسس العقيدة الإسلامية", "العبادات اليومية: الصلاة والصيام والزكاة", "الآداب الإسلامية وبناء الشخصية"],
    whoForEn: "Perfect for new Muslims, reverts, or anyone looking to build a solid foundation in Islamic knowledge and practice.",
    whoForAr: "مثالي للمسلمين الجدد والمُعتنقين وكل من يرغب في بناء أساس متين في المعرفة والممارسة الإسلامية.",
    outcomesEn: ["Understand the core beliefs of Islam", "Perform daily prayers correctly", "Know your obligations as a Muslim", "Build a confident Islamic identity"],
    outcomesAr: ["فهم أساسيات العقيدة الإسلامية", "أداء الصلوات اليومية بشكل صحيح", "معرفة واجباتك كمسلم", "بناء هوية إسلامية راسخة"],
  },
  "Islamic Jurisprudence (Fiqh)": {
    featuresEn: ["Fiqh of worship: prayer, fasting, Zakat & Hajj", "Fiqh of transactions and contracts", "Contemporary Fiqh issues", "Reference to classical madhabs (schools of law)"],
    featuresAr: ["فقه العبادات: الصلاة والصيام والزكاة والحج", "فقه المعاملات والعقود", "المسائل الفقهية المعاصرة", "الرجوع إلى المذاهب الفقهية الكلاسيكية"],
    whoForEn: "For students with a basic Islamic knowledge who wish to deepen their understanding of Islamic law and its practical rulings.",
    whoForAr: "للطلاب الذين لديهم معرفة إسلامية أساسية ويرغبون في التعمق في الفقه الإسلامي وأحكامه التطبيقية.",
    outcomesEn: ["Understand key rulings of Islamic law", "Apply Fiqh to everyday situations", "Navigate differences between madhabs", "Develop critical Islamic legal thinking"],
    outcomesAr: ["فهم الأحكام الفقهية الرئيسية", "تطبيق الفقه في الحياة اليومية", "التعامل مع الاختلافات بين المذاهب", "تطوير التفكير الفقهي النقدي"],
  },
  "On-demand Course": {
    featuresEn: [
      "Trial session for precise level & goal assessment",
      "Custom learning plan designed just for you",
      "Content from Quran, Tajweed, Arabic, Fiqh, Tafseer & more",
      "Continuous follow-up with plan adjustments as needed",
    ],
    featuresAr: [
      "حصة تجريبية لتقييم مستواك وأهدافك بدقة",
      "خطة تعلم مصممة خصيصاً لك",
      "محتوى من القرآن والتجويد والعربية والفقه والتفسير وغيرها",
      "متابعة مستمرة وتعديل الخطة عند الحاجة",
    ],
    whoForEn: "For students who don't know where to start, those with multiple learning goals, non-Arabic speakers, children and adults, and anyone seeking a flexible, personalised Islamic education — not a one-size-fits-all course.",
    whoForAr: "للطلاب الذين لا يعرفون من أين يبدأون، ومن لديهم أهداف متعددة، وغير الناطقين بالعربية، والأطفال والكبار، وكل من يبحث عن تعلم مرن ومخصص وليس كورساً تقليدياً.",
    outcomesEn: [
      "A clear, structured learning roadmap built for you",
      "Progress at your own pace and level",
      "Master the exact Islamic disciplines you need",
      "A flexible plan that evolves with your goals",
    ],
    outcomesAr: [
      "خارطة تعلم واضحة ومنظمة مبنية خصيصاً لك",
      "التقدم بالسرعة والمستوى الذي يناسبك",
      "إتقان العلوم الإسلامية التي تحتاجها تحديداً",
      "خطة مرنة تتطور مع أهدافك",
    ],
  },
  "Tafsir & Tadabbur": {
    featuresEn: [
      "Simplified explanation of selected Qur’anic verses",
      "Key spiritual and educational lessons",
      "Real-life application of Qur’anic teachings",
      "Moral and faith-based reflections",
    ],
    featuresAr: [
      "تفسير مبسط لآيات مختارة من القرآن الكريم",
      "استخراج الفوائد التربوية والإيمانية",
      "ربط الآيات بالواقع المعاصر",
      "رسائل إيمانية وسلوكية مستفادة من الآيات",
    ],
    whoForEn: "Students of all levels, those seeking practical application of the Quran in their daily lives, individuals with busy schedules, and anyone looking for a simplified, flexible approach rather than a traditional theoretical study.",
    whoForAr: "للطلاب من كافة المستويات، وللباحثين عن تطبيق عملي للقرآن في حياتهم، وأصحاب الأوقات المحدودة، وكل من يبحث عن فهم مبسط ومرن وليس دراسة نظرية تقليدية.",
    outcomesEn: [
      "Understand the meanings of Qur’anic verses in a simple and clear way",
      "Extract key lessons and moral insights from each verse",
      "Connect Qur’anic guidance to real-life situations",
      "Strengthen spiritual reflection and emotional connection with the Qur’an",
    ],
    outcomesAr: [
      "فهم معاني آيات القرآن الكريم بشكل صحيح ومبسط",
      "استخراج الدروس والعبر من كل آية",
      "ربط آيات القرآن بالحياة اليومية والمواقف العملية",
      "زيادة الخشوع والتأثر عند تلاوة القرآن",
    ],
  },
  "Prophetic Hadith": {
    featuresEn: [
      "One authentic hadith every class",
      "Simple explanation of the hadith meaning",
      "Key lessons and practical insights",
      "Real-life application of the hadith",
    ],
    featuresAr: [
      "حديث نبوي واحد صحيح فى كل حصة",
      "شرح مبسط لمعنى الحديث",
      "استخراج الفوائد والدروس العملية",
      "ربط الحديث بالحياة اليومية الواقعية",
    ],
    whoForEn: "Those seeking to revive the Prophetic Sunnah in their daily routines, individuals looking to refine their morals and behavior, and anyone who prefers a gradual, accessible approach (one Hadith per session) to turn the Sunnah into a tangible reality.",
    whoForAr: "الباحثين عن إحياء السنة النبوية في تفاصيل يومهم، ومن يسعون لتهذيب أخلاقهم وسلوكهم، وكل من يفضل دراسة متدرجة وميسرة (حديث واحد كل حصة) لتحويل السُّنة إلى واقع ملموس.",
    outcomesEn: [
      "Understand authentic Prophetic hadiths in a simple and clear way",
      "Learn the spiritual and educational meanings behind each hadith",
      "Apply the Sunnah in different daily life situations",
      "Improve character and behavior according to the guidance of the Prophet ﷺ",
    ],
    outcomesAr: [
      "فهم الأحاديث النبوية الصحيحة بطريقة مبسطة وواضحة",
      "التعرف على المعاني التربوية والإيمانية في كل حديث",
      "تطبيق السنة النبوية في المواقف اليومية المختلفة",
      "تحسين الأخلاق والسلوك وفق هدي النبي ﷺ",
    ],
  },
};

function CourseDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 animate-pulse">
      <Navbar />
      <main className="pt-32 pb-20">
        <div className="container-wide">
          <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20">
            <div className="aspect-video bg-slate-200 dark:bg-slate-700 rounded-3xl" />
            <div className="space-y-5">
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24" />
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-4/6" />
              </div>
              <div className="flex gap-4">
                <div className="h-14 bg-slate-200 dark:bg-slate-700 rounded-2xl flex-1" />
                <div className="h-14 bg-slate-200 dark:bg-slate-700 rounded-2xl flex-1" />
                <div className="h-14 bg-slate-200 dark:bg-slate-700 rounded-2xl flex-1" />
              </div>
              <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 space-y-3">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CourseDetails() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { id } = useParams();
  const { data: course, isLoading, isError, refetch } = useCourse(id || "");

  useEffect(()=>{if(course)applyMetadata(pageMetadata(`/courses/${course.id}`,isRTL?"ar":"en",undefined,course));},[course,isRTL]);

  if (isLoading) {
    return <CourseDetailsSkeleton />;
  }

  if (isError) return <div className="min-h-screen bg-slate-50 dark:bg-slate-950"><Navbar/><main className="container-wide pt-40 pb-24" role="alert"><h1>{t('restore.pageError')}</h1><p>{t('p4.failed')}</p><Button onClick={()=>refetch()}>{t('restore.retry')}</Button></main><Footer/></div>;
  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t("common.not_found")}</h1>
        <Link href="/courses">
          <Button variant="outline">{t("courses.back_to_courses")}</Button>
        </Link>
      </div>
    );
  }

  const extra = courseExtras[course.title] ?? {featuresEn:[],featuresAr:[],whoForEn:course.level,whoForAr:course.levelAr||course.level,outcomesEn:[],outcomesAr:[]};

  const title       = isRTL && course.titleAr       ? course.titleAr       : course.title;
  const description = isRTL && course.descriptionAr ? course.descriptionAr : course.description;
  const level       = isRTL && course.levelAr        ? course.levelAr       : course.level;
  const duration    = isRTL && course.durationAr     ? course.durationAr    : course.duration;
  const classDetail = isRTL && course.classDetailsAr ? course.classDetailsAr : course.classDetails;
  const imageUrl    = isRTL && course.imageUrlAr     ? course.imageUrlAr    : course.imageUrl;

  return (
    <div className="academy-course-page min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <main className="academy-course-main relative isolate pt-32 pb-20">
        <PageBackdrop variant="courses" />
        <div className="container-wide">
          <Link href="/courses">
            <Button variant="ghost" className="mb-8 hover:bg-transparent p-0 text-slate-500 dark:text-slate-400 hover:text-primary transition-colors gap-2">
              <ArrowLeft className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
              {t("courses.back_to_courses")}
            </Button>
          </Link>

          {/* Hero grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div data-no-reveal>
              <div className="academy-course-cover relative aspect-video rounded-3xl overflow-hidden shadow-2xl shadow-slate-200 dark:shadow-slate-900">
                <img src={imageUrl} alt={title} width={1600} height={900} fetchPriority="high" decoding="async" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className={`absolute top-6 ${isRTL ? "left-6" : "right-6"}`}>
                  <Badge className="bg-white/95 text-primary hover:bg-white/95 px-4 py-1 text-sm font-bold shadow-sm border-none">
                    {level}
                  </Badge>
                </div>
              </div>
            </div>

            <div data-reveal
              className="flex flex-col gap-6 text-start"
            >
              <div>
                <span className="text-secondary font-bold tracking-widest uppercase text-sm">{t("courses.details")}</span>
                <h1 className="text-4xl lg:text-5xl font-display font-bold text-slate-900 dark:text-slate-100 leading-tight mt-2">
                  {title}
                </h1>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 shadow-sm">

                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">{t("courses.duration")}</p>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{duration}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 shadow-sm">

                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">{t("courses.class_type")}</p>
                    <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{classDetail || t("courses.personal_class")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 shadow-sm">

                  <div>
                    <p className="text-xs text-slate-400 font-semibold uppercase">{t("courses.tuition")}</p>
                    <p className="font-bold text-primary text-sm">{isRTL && course.price === "Based on package" ? t("polish.packagePrice") : course.price}</p>
                  </div>
                </div>
              </div>

              <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>

              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-6">
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">{t("pageUi.CourseDetails.Who_is_this_for")}</p>
                <p className="text-slate-700 dark:text-slate-300">{isRTL ? extra.whoForAr : extra.whoForEn}</p>
              </div>

              <div className="pt-4 flex flex-wrap gap-4">
                <Link href={`/contact?tab=trial&course=${encodeURIComponent(course.title)}`}>
                  <Button size="lg" variant="outline" className="px-8 h-14 text-lg font-bold border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all">
                    {t("courses.free_trial")}
                  </Button>
                </Link>
                <Link href={`/contact?tab=enroll&course=${encodeURIComponent(course.title)}`}>
                  <Button size="lg" className="px-8 h-14 text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
                    {t("courses.enroll")}
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* What you'll learn + Features */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-6">

                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">{t("courses.what_learn")}</h2>
              </div>
              <ul className="space-y-4">
                {(isRTL ? extra.outcomesAr : extra.outcomesEn).map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <span className="academy-dot" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-6">

                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
                  {t("pageUi.CourseDetails.Course_Features")}
                </h2>
              </div>
              <ul className="space-y-4">
                {(isRTL ? extra.featuresAr : extra.featuresEn).map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                    <span className="academy-dot" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-3xl p-10 text-center text-white">
            <h2 className="text-3xl font-display font-bold mb-3">
              {t("pageUi.CourseDetails.Ready_to_Get_Started")}
            </h2>
            <p className="text-white/80 mb-8 text-lg">
              {t("pageUi.CourseDetails.Your_first_session_is_completely_free_No_credit_card_required")}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href={`/contact?tab=trial&course=${encodeURIComponent(course.title)}`}>
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 h-14 px-8 text-lg font-bold rounded-xl shadow-lg">
                  {t("courses.free_trial")}
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 h-14 px-8 text-lg font-bold rounded-xl">
                  {t("pageUi.CourseDetails.View_Pricing")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
