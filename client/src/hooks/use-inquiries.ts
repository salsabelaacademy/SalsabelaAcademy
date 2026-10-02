import i18n from "@/lib/i18n";
import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import type { InsertInquiry } from "@shared/schema";

export type InquiryMeta = {
  turnstileToken?: string;
  language?: string;
  inquiryType?: "trial" | "enroll";
  selectedPlan?: string;
  planPrice?: string;
};

export function useCreateInquiry(language = "en") {
  const { toast } = useToast();
  const tr = (key:string) => i18n.t("review."+key,{lng:language});

  return useMutation({
    mutationFn: async (data: InsertInquiry & InquiryMeta) => {
      const res = await fetch("/api/contact", {
        method: api.inquiries.create.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({name:data.name,email:data.email,subject: `${tr(data.inquiryType === 'enroll' ? 'enrollmentInquiry' : 'courseInquiry')}: ${data.courseInterest}`.slice(0,160),message:[`${tr("courseLabel")}: ${data.courseInterest}`,`${tr("phoneLabel")}: ${data.phone || '-'}`,`${tr("planLabel")}: ${data.selectedPlan || '-'} ${data.planPrice || ''}`,data.message||''].join('\n'),turnstileToken:data.turnstileToken}),
      });

      if (!res.ok) {
        throw new Error(res.status === 429 ? "inquiryLimited" : res.status === 403 ? "inquirySecurity" : "inquiryError");
      }

      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: i18n.t("review.inquirySent"),
        description: i18n.t("review.inquiryReceived"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: i18n.t("review.inquiryError"),
        description: i18n.t("review." + error.message),
        variant: "destructive",
      });
    },
  });
}
