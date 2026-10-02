import { Resend } from "resend";

export function notificationStatus(env = process.env) {
  const from = env.RESEND_FROM || "";
  const email = from.match(/(?:^|<)([\w.+-]+@([\w.-]+))(?:>|$)/)?.[1];
  const domain = email?.split("@")[1]?.toLowerCase();
  const configured = Boolean(env.RESEND_API_KEY && email && domain === "notifications.salsabela.com");
  return { configured, sender: configured ? email : null, domain: "notifications.salsabela.com" };
}

type Send = (message: { from: string; to: string; subject: string; html: string }) => Promise<{ data?: { id?: string } | null; error?: unknown }>;

export async function sendNotificationTest(to: string, env = process.env, sender?: Send) {
  if (!notificationStatus(env).configured) throw new Error("not_configured");
  const send = sender || ((message) => new Resend(env.RESEND_API_KEY).emails.send(message));
  const result = await send({
    from: env.RESEND_FROM!, to,
    subject: "Salsabela Academy — Email test / اختبار البريد",
    html: "<p>Salsabela Academy email delivery test.</p><p>رسالة اختبار لإرسال البريد من أكاديمية سلسبيلا.</p>",
  });
  if (result.error || !result.data?.id) throw new Error("email_delivery_failed");
  return { sent: true };
}
