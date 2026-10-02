import TurnstileWidget, {useTurnstileConfig} from "@/components/TurnstileWidget";
import { useState } from "react";
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

export function InquiryForm() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const searchParams = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const preselectedCourse = searchParams.get("course");
  const { data: courses = [] } = useCourses();
  const [submitted, setSubmitted] = useState(false);

  const createInquiry = useCreateInquiry(isRTL ? "ar" : "en");
  const config=useTurnstileConfig();
  const [token,setToken]=useState("");
  const [challengeKey,setChallengeKey]=useState(0);

  const form = useForm<InsertInquiry>({
    resolver: zodResolver(insertInquirySchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      courseInterest: preselectedCourse || "",
      message: "",
    },
  });

  const onSubmit = (data: InsertInquiry) => {
    createInquiry.mutate({...data,turnstileToken:token}, {
      onSettled:()=>{setToken("");setChallengeKey(k=>k+1);},
      onSuccess: () => {
        form.reset();
        setSubmitted(true);
      },
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 text-start">
      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="success"
            initial={false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-center py-10"
          >

            <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 mb-2">
              {t("pageUi.InquiryForm.Request_Sent")}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              {t("pageUi.InquiryForm.Thank_you_We_ll_contact_you_to_coordinate_your_session")}
            </p>
            <Button className="btn-primary" onClick={() => setSubmitted(false)}>
              {t("pageUi.InquiryForm.Send_Another_Request")}
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <h3 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100 mb-2">{t("contact.form_title")}</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">{t("contact.form_subtitle")}</p>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("contact.full_name")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("pageUi.InquiryForm.Mohamed")}
                          className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100 focus:border-primary"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("contact.email_addr")}</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="email@example.com"
                            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100 focus:border-primary"
                            {...field}
                          />
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
                          <Input
                            type="tel"
                            placeholder="+1 (555) 000-0000"
                            className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100 focus:border-primary"
                            {...field}
                            value={field.value || ''}
                          />
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
                          <SelectTrigger className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100 focus:border-primary">
                            <SelectValue placeholder={t("contact.interest")} />
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

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("contact.message")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("contact.message_placeholder")}
                          className="resize-none bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100 focus:border-primary min-h-[100px]"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {config?.enabled && config.siteKey ? <TurnstileWidget key={challengeKey} siteKey={config.siteKey} onToken={setToken} onError={()=>setToken("")}/> : !config?.developmentBypass && <p role="status">{t(config ? 'accountFlow.securityUnavailable' : 'p4.loading')}</p>}
                {createInquiry.isError && <p role="alert" className="text-red-600">{t('p4.failed')}</p>}
                <Button
                  type="submit"
                  className="w-full btn-primary h-12 text-lg mt-2"
                  disabled={createInquiry.isPending || !(config?.developmentBypass || (config?.enabled && token))}
                >
                  {createInquiry.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {t("contact.submitting")}
                    </>
                  ) : (
                    t("contact.submit")
                  )}
                </Button>

                <p className="text-xs text-center text-slate-400 mt-4">
                  {t("contact.privacy")}
                </p>
              </form>
            </Form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
