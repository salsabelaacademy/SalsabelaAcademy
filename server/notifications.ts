import { emailErrorCode } from "./email-errors";
import { brandedEmail } from "./email-template";
import { Resend } from "resend";

export function notificationStatus(env = process.env) {
  const from = env.RESEND_FROM || "";
  const email = from.match(/(?:^|<)([\w.+-]+@([\w.-]+))(?:>|$)/)?.[1];
  const domain = email?.split("@")[1]?.toLowerCase();
  const configured = Boolean(
    env.RESEND_API_KEY && email && domain === "notifications.salsabela.com",
  );
  return {
    configured,
    sender: configured ? email : null,
    domain: "notifications.salsabela.com",
  };
}

type Send = (message: {
  from: string;
  to: string;
  subject: string;
  html: string;
}) => Promise<{ data?: { id?: string } | null; error?: unknown }>;

export async function sendNotificationTest(
  to: string,
  env = process.env,
  sender?: Send,
  language: "ar" | "en" = "en",
) {
  if (!notificationStatus(env).configured) throw new Error("not_configured");
  const send =
    sender ||
    ((message) => new Resend(env.RESEND_API_KEY).emails.send(message));
  const result = await send({
    from: env.RESEND_FROM!,
    to,
    subject: language === "ar" ? "أكاديمية سلسبيلا — اختبار البريد" : "Salsabela Academy — Email test",
    ...brandedEmail(
      {
        title: language === "ar" ? "اختبار البريد" : "Email test",
        language,
        body: language === "ar" ? "هذه رسالة اختبار لإرسال البريد من أكاديمية سلسبيلا." : "This is an email delivery test from Salsabela Academy.",
        url: (env.FRONTEND_URL || "https://salsabela.com") + (language === "ar" ? "/ar" : "") + "/dashboard/admin",
      },
      env.FRONTEND_URL || "https://salsabela.com",
    ),
  });
  if (result.error || !result.data?.id)
    throw new Error(emailErrorCode(result.error));
  return { sent: true };
}
