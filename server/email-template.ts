import { readFileSync } from "node:fs";
import { resolve } from "node:path";
export function escapeEmail(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export type EmailContent = {
  title: string;
  body: string;
  language?: string;
  name?: string;
  url: string;
  button?: string;
  details?: { label: string; value: string }[];
};
let embeddedLogo: string | undefined;
function logoAttachment() {
  if (!embeddedLogo) {
    const file = resolve(process.cwd(), process.env.NODE_ENV === "production" ? "dist/public/logo-icon.png" : "client/public/logo-icon.png");
    const bytes = readFileSync(file);
    if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error("email_logo_invalid");
    embeddedLogo = bytes.toString("base64");
  }
  return { filename: "salsabela-logo.png", content: embeddedLogo, contentId: "salsabela-logo" };
}
export function brandedEmail(value: EmailContent, origin: string) {
  const ar = value.language === "ar",
    e = escapeEmail;
  const url = new URL(value.url),
    base = new URL(origin);
  if (
    !["https:", "http:"].includes(base.protocol) ||
    url.origin !== base.origin ||
    url.username ||
    url.password
  )
    throw new Error("unsafe_email_link");
  const greeting = ar ? "السلام عليكم ورحمة الله" : "As-salamu alaykum";
  const footer = ar ? "للتواصل مع الأكاديمية" : "Contact the academy";
  const text = [
    value.title,
    `${greeting}${value.name ? " " + value.name : ""}`,
    value.body,
    ...(value.details || []).map((d) => d.label + ": " + d.value),
    value.url,
    "info@salsabela.com",
  ].join("\n\n");
  const font = ar ? "Tahoma, 'Segoe UI', Arial, sans-serif" : "'Segoe UI', Arial, Helvetica, sans-serif";
  const brand = ar ? "أكاديمية سلسبيلا" : "Salsabela Academy";
  const paragraphs = value.body.split(/\n\s*\n/).map(line => `<p style="margin:0 0 18px;font-size:16px;line-height:1.9">${e(line).replace(/\n/g,"<br>")}</p>`).join("");
  const html = `<!doctype html><html lang="${ar ? "ar" : "en"}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f6f7;color:#233747;font-family:${font}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #dfe6e8;border-top:4px solid #1b5d60"><tr><td style="padding:28px 28px 24px;border-bottom:1px solid #e6ecee"><table role="presentation" width="100%"><tr><td width="68"><img src="cid:salsabela-logo" width="56" height="56" alt="${brand}" style="display:block;width:56px;height:56px;object-fit:contain"></td><td style="text-align:${ar ? "right" : "left"};padding-inline-start:12px"><strong style="font-size:20px;font-weight:600;color:#173e48">${brand}</strong><br><span style="font-size:13px;color:#6a7a84;line-height:1.8">${ar ? "القرآن الكريم واللغة العربية" : "Qur’an and Arabic learning"}</span></td></tr></table></td></tr><tr><td style="padding:30px 28px;text-align:${ar ? "right" : "left"};direction:${ar ? "rtl" : "ltr"}"><h1 style="font-size:23px;line-height:1.6;font-weight:600;margin:0 0 22px;color:#173e48">${e(value.title)}</h1><p style="font-size:16px;line-height:1.9;margin:0 0 18px">${greeting}${value.name ? " " + e(value.name) : ""}${ar ? "،" : ","}</p>${paragraphs}${value.details?.length ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-top:1px solid #e6ecee">' + value.details.map(d=>`<tr><td style="padding:12px 0;border-bottom:1px solid #e6ecee;font-size:14px;color:#687b88">${e(d.label)}</td><td style="padding:12px 8px;border-bottom:1px solid #e6ecee;font-size:15px;color:#233747">${e(d.value)}</td></tr>`).join("")+'</table>' : ""}<p style="margin:28px 0"><a href="${e(url.href)}" style="display:inline-block;background:#1b5d60;color:#fff;text-decoration:none;padding:13px 22px;border-radius:5px;font-size:15px;font-weight:600;line-height:1.5">${e(value.button || (ar ? "افتح لوحة الأكاديمية" : "Open academy dashboard"))}</a></p><p style="font-size:12px;line-height:1.8;color:#6a7a84;margin:0">${ar ? "إذا لم يعمل الزر، افتح الرابط التالي:" : "If the button does not work, open this link:"}<br><a href="${e(url.href)}" style="color:#1b5d60;word-break:break-all;overflow-wrap:anywhere">${e(url.href)}</a></p></td></tr><tr><td style="padding:20px 28px;border-top:1px solid #e6ecee;text-align:${ar ? "right" : "left"};font-size:13px;color:#6a7a84;line-height:1.9">${footer}<br><a href="mailto:info@salsabela.com" style="color:#1b5d60;text-decoration:none">info@salsabela.com</a><br><a href="mailto:salsabela.academy@gmail.com" style="color:#1b5d60;text-decoration:none">salsabela.academy@gmail.com</a></td></tr></table></td></tr></table></body></html>`;
  return { html, text, attachments: [logoAttachment()] };
}
export function authEmail(path: string, token: string, origin: string) {
  const url = new URL(path);
  const ar = url.pathname.startsWith("/ar/");
  const kind = url.pathname.includes("accept-invitation")
    ? "invitation"
    : url.pathname.includes("reset-password")
      ? "reset"
      : "verify";
  const copies = {
    invitation: ar
      ? [
          "دعوتك إلى أكاديمية سلسبيلا",
          "تم قبولك في الأكاديمية. أنشئ كلمة مرور حسابك من الرابط الآمن أدناه. تنتهي صلاحية الدعوة خلال 7 أيام.",
          "تفعيل حسابي",
        ]
      : [
          "Your Salsabela Academy invitation",
          "Welcome to the academy. Create your account password using the secure link below. Your invitation expires in 7 days.",
          "Activate my account",
        ],
    reset: ar
      ? [
          "استعادة كلمة المرور",
          "تلقّينا طلبًا لاستعادة كلمة مرور حسابك. استخدم الرابط أدناه قبل انتهاء صلاحيته. إذا لم تطلب ذلك، تجاهل الرسالة.",
          "تعيين كلمة مرور جديدة",
        ]
      : [
          "Reset your password",
          "We received a password reset request. Use the secure link before it expires. If you did not request this, ignore this email.",
          "Reset password",
        ],
    verify: ar
      ? [
          "تأكيد بريدك الإلكتروني",
          "أكّد بريدك الإلكتروني لإكمال إعداد حسابك في الأكاديمية.",
          "تأكيد البريد",
        ]
      : [
          "Verify your email",
          "Confirm your email address to finish setting up your academy account.",
          "Verify email",
        ],
  }[kind];
  url.searchParams.set("token", token);
  return {
    subject: copies[0],
    ...brandedEmail(
      {
        title: copies[0],
        body: copies[1],
        button: copies[2],
        language: ar ? "ar" : "en",
        url: url.href,
      },
      origin,
    ),
  };
}
