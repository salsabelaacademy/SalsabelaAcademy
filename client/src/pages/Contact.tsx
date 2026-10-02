import { PageBackdrop } from "@/components/PageBackdrop";
import TurnstileWidget, {useTurnstileConfig} from "@/components/TurnstileWidget";
import { useState, useMemo, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateInquiry } from "@/hooks/use-inquiries";
import { useCourses } from "@/hooks/use-courses";
import { insertInquirySchema, type InsertInquiry } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/use-language";
import { motion, AnimatePresence } from "framer-motion";
import type { Course } from "@shared/schema";
import { Link, useSearch } from "wouter";

type Tab = "trial" | "enroll";

function ContactForm({ type, onSuccess, courses }: { type: Tab; onSuccess: () => void; courses: Course[] }) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const createInquiry = useCreateInquiry(isRTL ? "ar" : "en");
  const config=useTurnstileConfig();
  const [token,setToken]=useState("");
  const [challengeKey,setChallengeKey]=useState(0);

  const searchParams = new URLSearchParams(useSearch());
  const preselectedCourse = searchParams.get("course");

  const form = useForm<InsertInquiry>({
    resolver: zodResolver(insertInquirySchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      courseInterest: preselectedCourse || (courses[0]?.title ?? ""),
      message: "",
    },
  });

  const plans = [
    { key: "Basic",    labelEn: "Basic",    labelAr: "أساسية",  priceEn: "$9/hr", priceAr: "9$/ساعة" },
    { key: "Standard", labelEn: "Standard", labelAr: "معيارية", priceEn: "$11/hr", priceAr: "11$/ساعة" },
    { key: "Premium",  labelEn: "Premium",  labelAr: "مميزة",   priceEn: "$13/hr", priceAr: "13$/ساعة" },
  ];
  const [selectedPlan, setSelectedPlan] = useState(plans.some(p=>p.key===searchParams.get("plan"))?searchParams.get("plan")!:"Standard");

  const planFromUrl = searchParams.get("plan");
  useEffect(() => {
    if (["Basic", "Standard", "Premium"].includes(planFromUrl || "")) setSelectedPlan(planFromUrl!);
  }, [planFromUrl]);
  useEffect(() => {
    if (preselectedCourse) form.setValue("courseInterest", preselectedCourse);
  }, [preselectedCourse, form]);

  const onSubmit = (data: InsertInquiry) => {
    const plan = plans.find(p => p.key === selectedPlan);
    const planPrice = plan ? plan.priceEn : "";
    createInquiry.mutate(
      { ...data, inquiryType: type, selectedPlan, planPrice, turnstileToken:token },
      { onSuccess, onSettled:()=>{setToken("");setChallengeKey(k=>k+1);} }
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("contact.full_name")}</FormLabel>
              <FormControl>
                <Input placeholder={t("pageUi.Contact.Mohamed")} className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-primary dark:text-slate-100 h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("contact.email_addr")}</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@example.com" className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-primary dark:text-slate-100 h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("contact.phone_num")}</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="+1 555 000 0000" className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-primary dark:text-slate-100 h-11" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="courseInterest"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("contact.interest")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100 h-11">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.title}>
                      {isRTL ? course.titleAr || course.title : course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {type === "enroll" && (
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">{t("contact.plan_label")}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {plans.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSelectedPlan(p.key)}
                  className={`border-2 rounded-xl p-3 text-start transition-all ${selectedPlan === p.key ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500"}`}
                >
                  <p className={`font-bold text-sm ${selectedPlan === p.key ? "text-primary" : "text-slate-700 dark:text-slate-300"}`}>
                    {isRTL ? p.labelAr : p.labelEn}
                  </p>
                  <p className={`text-xs font-bold mt-1 ${selectedPlan === p.key ? "text-primary" : "text-slate-600 dark:text-slate-400"}`}>
                    {isRTL ? p.priceAr : p.priceEn}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("contact.message")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("contact.message_placeholder")}
                  className="resize-none bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-primary dark:text-slate-100 min-h-[90px]"
                  {...field}
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {config?.enabled && config.siteKey ? <TurnstileWidget key={challengeKey} siteKey={config.siteKey} onToken={setToken} onError={()=>setToken("")}/> : !config?.developmentBypass && <p role="status">{t(config ? 'accountFlow.securityUnavailable' : 'p4.loading')}</p>}
                {createInquiry.isError && <p role="alert" className="text-red-600">{t('p4.failed')}</p>}
                <Button type="submit" className="w-full btn-primary h-12 text-base font-bold" disabled={createInquiry.isPending || !(config?.developmentBypass || (config?.enabled && token))}>
          {createInquiry.isPending ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{t("contact.submitting")}</>
          ) : (
            type === "enroll" ? t("contact.submit_enroll") : t("contact.submit")
          )}
        </Button>

        <p className="text-xs text-center text-slate-400">{t("contact.privacy")}</p>
      </form>
    </Form>
  );
}

export default function Contact() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { data: courses = [] } = useCourses();

  const searchParams = new URLSearchParams(useSearch());
  const initialTab = searchParams.get("tab") === "enroll" ? "enroll" : "trial";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab as Tab);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { setActiveTab(initialTab); setSubmitted(false); }, [initialTab]);

  const userTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }, []);

  const localTime = useMemo(() => {
    try {
      return new Date().toLocaleTimeString(isRTL ? "ar" : "en", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: userTimezone ?? undefined,
      });
    } catch {
      return null;
    }
  }, [userTimezone, isRTL]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <section className="academy-hero-surface pt-32 pb-20"><PageBackdrop variant="contact" />
        <div className="container-wide">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

            {/* Left info panel */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h1 className="text-4xl lg:text-5xl font-display font-bold text-slate-900 dark:text-slate-100 mb-4 text-start">
                  {t("contact.title")}
                </h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 text-start">{t("contact.subtitle")}</p>
                <Link href="/apply" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">{t("p4.unified")}</Link>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <span className="academy-contact-rule" aria-hidden="true" />
                  <div className="text-start">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">{t("contact.email_us")}</h3>
                     <div className="flex flex-col gap-2 min-w-0"><a dir="ltr" href="mailto:info@salsabela.com" className="text-slate-600 dark:text-slate-400 hover:text-primary text-sm transition-colors break-all">info@salsabela.com</a><a dir="ltr" href="mailto:salsabela.academy@gmail.com" className="text-slate-600 dark:text-slate-400 hover:text-primary text-sm transition-colors break-all">salsabela.academy@gmail.com</a></div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <span className="academy-contact-rule" aria-hidden="true" />
                  <div className="text-start">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">{t("contact.call_us")}</h3>
                     <a href="tel:+201152741590" dir="ltr" className="text-slate-600 dark:text-slate-400 hover:text-primary text-sm transition-colors">+20 1152741590</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <span className="academy-contact-rule" aria-hidden="true" />
                  <div className="text-start">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">{t("contact.location")}</h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">{t("pageUi.Contact.Online_Academy_Serving_Worldwide")}</p>
                  </div>
                </div>

                {userTimezone && (
                  <div className="flex items-start gap-4">
                    <span className="academy-contact-rule" aria-hidden="true" />
                    <div className="text-start">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">{t("contact.timezone_label")}</h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm font-mono">{userTimezone}</p>
                      {localTime && (
                        <p className="text-primary text-sm font-semibold mt-0.5">
                          {t("review.currentTime",{time:localTime})}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20 rounded-2xl p-6 border border-primary/10">
                <p className="font-bold text-slate-900 dark:text-slate-100 mb-2 text-start">
                  {t("pageUi.Contact.Why_a_free_trial")}
                </p>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed text-start">
                  {t("pageUi.Contact.Explore_the_learning_approach_and_discuss_your_level_and_goals_in")}
                </p>
              </div>
            </div>

            {/* Right form panel */}
            <div className="lg:col-span-3">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-800 overflow-hidden">

                {/* Tabs */}
                <div className="grid grid-cols-2 border-b border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => { setActiveTab("trial"); setSubmitted(false); }}
                    className={`flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all ${activeTab === "trial" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                  >

                    {t("contact.tab_trial")}
                  </button>
                  <button
                    onClick={() => { setActiveTab("enroll"); setSubmitted(false); }}
                    className={`flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all ${activeTab === "enroll" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
                  >

                    {t("contact.tab_enroll")}
                  </button>
                </div>

                <div className="p-8">
                  <AnimatePresence mode="wait">
                    {submitted ? (
                      <motion.div
                        key="success"
                        initial={false}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12"
                      >

                        <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mb-3">{t("contact.success_title")}</h3>
                        <p className="text-slate-600 dark:text-slate-400">{t("contact.success_msg")}</p>
                        <Button className="mt-8 btn-primary" onClick={() => setSubmitted(false)}>
                          {t("pageUi.Contact.Send_Another_Request")}
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key={activeTab}
                        initial={false}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <div className="mb-6 text-start">
                          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
                            {activeTab === "trial" ? t("contact.trial_title") : t("contact.enroll_title")}
                          </h2>
                          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                            {activeTab === "trial" ? t("contact.trial_subtitle") : t("contact.enroll_subtitle")}
                          </p>
                        </div>
                         {activeTab === "trial" ? (
                           <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
                             <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">{t("p4.applicationIntro")}</p>
                             <Link href={"/apply"+(searchParams.get("course")?"?course="+encodeURIComponent(searchParams.get("course")!):"")}><Button className="btn-primary">{t("p4.unified")}</Button></Link>
                           </div>
                         ) : <ContactForm type={activeTab} onSuccess={() => setSubmitted(true)} courses={courses} />}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
