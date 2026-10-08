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
  const html = `<!doctype html><html lang="${ar ? "ar" : "en"}" dir="${ar ? "rtl" : "ltr"}"><body style="margin:0;background:#f1f4f2;color:#173442;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #e0e8e2;border-radius:18px;overflow:hidden"><tr><td align="center" style="background:#123e3b;padding:28px;color:#fff"><img src="${e(base.origin + "/logo-icon.png")}" width="72" height="72" alt="Salsabela Academy" style="display:block;margin:0 auto 12px"><strong style="font-size:23px">Salsabela Academy</strong><p style="color:#d9ba72;margin:8px 0 0">${ar ? "رحلتك مع القرآن والعربية" : "Your journey with Qur’an and Arabic"}</p></td></tr><tr><td style="padding:32px 28px;text-align:${ar ? "right" : "left"}"><h1 style="font-size:24px;line-height:1.5;margin:0 0 20px">${e(value.title)}</h1><p style="font-size:16px;line-height:1.8">${greeting}${value.name ? " " + e(value.name) : ""},</p><p style="font-size:16px;line-height:1.9;white-space:pre-line">${e(value.body)}</p>${value.details?.length ? '<table role="presentation" width="100%" style="background:#f3f7f5;border-radius:12px;padding:14px">' + value.details.map((d) => `<tr><td style="padding:8px;font-size:14px;color:#607467">${e(d.label)}</td><td style="padding:8px;font-size:15px;font-weight:bold">${e(d.value)}</td></tr>`).join("") + "</table>" : ""}<p style="text-align:center;margin:28px 0"><a href="${e(url.href)}" style="display:inline-block;background:#21644f;color:#fff;text-decoration:none;padding:15px 26px;border-radius:8px;font-size:16px;font-weight:bold">${e(value.button || (ar ? "افتح لوحة الأكاديمية" : "Open academy dashboard"))}</a></p><p style="font-size:12px;line-height:1.8;color:#66786c">${ar ? "إذا لم يعمل الزر، انسخ هذا الرابط في المتصفح:" : "If the button does not work, copy this link into your browser:"}<br><a href="${e(url.href)}" style="color:#21644f;word-break:break-all">${e(url.href)}</a></p></td></tr><tr><td align="center" style="padding:24px;background:#f6f7f3;font-size:13px;color:#52665d;line-height:1.8">${footer}: <a href="mailto:info@salsabela.com" style="color:#21644f">info@salsabela.com</a><br><a href="mailto:salsabela.academy@gmail.com" style="color:#21644f">salsabela.academy@gmail.com</a></td></tr></table></td></tr></table></body></html>`;
  return { html, text };
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
