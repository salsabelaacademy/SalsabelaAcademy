import { Resend } from "resend";
import { pool } from "./db";
import { brandedEmail } from "./email-template";
export function emailReady(env = process.env) {
  try {
    const u = new URL(env.FRONTEND_URL || "");
    return Boolean(
      env.RESEND_API_KEY && env.RESEND_FROM && u.protocol === "https:",
    );
  } catch {
    return false;
  }
}
export function notificationEmail(row: any, origin: string) {
  const ar = row.language === "ar",
    lang = ar ? "ar" : "en",
    ctx = row.context || {};
  const words: Record<string, string> = ar
    ? {
        notify_enrollment: "تحديث التحاقك بالدورة",
        notify_assessment: "تحديث موعد التقييم",
        confirmed: "تم تأكيد موعدك",
        notify_lesson: "تحديث حصتك في الأكاديمية",
        notify_message: "رسالة جديدة في الأكاديمية",
        notify_application: "طلب تقديم جديد",
        notify_contact: "رسالة تواصل جديدة",
        scheduled: "تمت جدولة حصتك",
        rescheduled: "تم تغيير موعد حصتك",
        cancelled: "تم إلغاء الحصة",
        completed: "اكتملت الحصة",
        no_show: "تحديث حضور الحصة",
        updated: "تم تحديث تفاصيل حصتك",
        date: "الموعد",
        timezone: "المنطقة الزمنية",
        title: "الحصة",
      }
    : {
        notify_enrollment: "Your course enrollment update",
        notify_assessment: "Your assessment update",
        confirmed: "Your appointment is confirmed",
        notify_lesson: "Your academy lesson update",
        notify_message: "A new academy message",
        notify_application: "New academy application",
        notify_contact: "New contact message",
        scheduled: "Your lesson is scheduled",
        rescheduled: "Your lesson has been rescheduled",
        cancelled: "Your lesson is cancelled",
        completed: "Your lesson is complete",
        no_show: "Lesson attendance update",
        updated: "Your lesson details have been updated",
        date: "Date and time",
        timezone: "Timezone",
        title: "Lesson",
      };
  let zone = row.timezone || "UTC";
  try {
    new Intl.DateTimeFormat(lang, { timeZone: zone });
  } catch {
    zone = "UTC";
  }
  const details = [];
  if (ctx.startsAt) {
    const format = new Intl.DateTimeFormat(lang, {
      timeZone: zone,
      dateStyle: "full",
      timeStyle: "short",
    });
    details.push({
      label: words.date,
      value: format.format(new Date(ctx.startsAt)),
    });
    if (ctx.endsAt)
      details.push({
        label: ar ? "نهاية الحصة" : "Lesson ends",
        value: format.format(new Date(ctx.endsAt)),
      });
    details.push({ label: words.timezone, value: zone });
  }
  const title =
    words[row.title] ||
    (ar ? "تحديث جديد من أكاديمية سلسبيلا" : "A Salsabela Academy update");
  const lead = ctx.change
    ? words[ctx.change] || words.updated
    : row.title === "notify_message"
      ? ar
        ? "لديك رسالة جديدة. افتح المحادثات من الزر داخل لوحة الأكاديمية."
        : "You have a new message. Open the messenger button in your academy dashboard."
      : ar
        ? "لديك تحديث جديد في الأكاديمية."
        : "You have a new academy update.";
  const route =
    row.title === "notify_message"
      ? "?tab=messages"
      : ctx.lessonId
        ? "?tab=lessons"
        : "?tab=notifications";
  const url = origin + (ar ? "/ar" : "") + "/dashboard/" + row.role + route;
  return {
    subject: title,
    ...brandedEmail(
      {
        title,
        body: lead + (row.body ? "\n\n" + row.body : ""),
        language: lang,
        name: row.name,
        url,
        details,
      },
      origin,
    ),
  };
}
export async function processEmailJob(
  send?: (message: any, key: string) => Promise<any>,
) {
  if (!emailReady()) return false;
  const { rows } = await pool.query(
    `UPDATE email_deliveries SET status='sending',attempts=attempts+1,next_attempt=now()+interval '2 minutes' WHERE id=(SELECT id FROM email_deliveries WHERE status IN ('pending','sending') AND attempts<5 AND next_attempt<=now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
  );
  const job = rows[0];
  if (!job) return false;
  try {
    const result = await pool.query(
      `SELECT n.title,n.body,n.context,u.name,u.email,u.role,u.status,COALESCE(a.preferred_language,s.preferred_language,'en') AS language,COALESCE(a.timezone,s.timezone,'UTC') AS timezone,COALESCE(p.email_updates,true) AS enabled FROM notifications n JOIN users u ON u.id=n.user_id LEFT JOIN account_details a ON a.user_id=u.id LEFT JOIN student_profiles s ON s.user_id=u.id LEFT JOIN account_preferences p ON p.user_id=u.id WHERE n.id=$1 AND n.created_at>now()-interval '23 hours'`,
      [job.notification_id],
    );
    const row = result.rows[0];
    if (!row || row.status !== "active" || !row.enabled) {
      await pool.query(
        "UPDATE email_deliveries SET status='skipped' WHERE id=$1",
        [job.id],
      );
      return true;
    }
    const draft = {
      from: process.env.RESEND_FROM!,
      to: row.email,
      ...notificationEmail(row, new URL(process.env.FRONTEND_URL!).origin),
    };
    const saved = await pool.query(
      "UPDATE email_deliveries SET payload=COALESCE(payload,$2::jsonb) WHERE id=$1 RETURNING payload",
      [job.id, JSON.stringify(draft)],
    );
    const payload = saved.rows[0].payload;
    const key = "academy-notification-" + job.notification_id;
    const sent = send
      ? await send(payload, key)
      : await new Resend(process.env.RESEND_API_KEY).emails.send(payload, {
          idempotencyKey: key,
        });
    if (sent.error || !sent.data?.id) throw Error("delivery_failed");
    await pool.query(
      "UPDATE email_deliveries SET status='sent',last_error=NULL WHERE id=$1",
      [job.id],
    );
  } catch {
    await pool.query(
      "UPDATE email_deliveries SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,next_attempt=now()+interval '1 minute'*power(2,attempts),last_error='delivery_failed' WHERE id=$1",
      [job.id],
    );
    console.warn(
      JSON.stringify({ event: "email_delivery_failed", jobId: job.id }),
    );
  }
  return true;
}
export function startEmailWorker() {
  let stopped = false,
    busy = false;
  const tick = async () => {
    if (stopped || busy || !emailReady()) return;
    busy = true;
    try {
      for (let i = 0; i < 10 && !stopped; i++) {
        if (!(await processEmailJob())) break;
      }
      await pool.query(
        "UPDATE email_deliveries SET status='failed',last_error='retry_limit' WHERE status IN ('pending','sending') AND attempts>=5 AND next_attempt<=now()",
      );
    } catch {
      console.warn(JSON.stringify({ event: "email_worker_unavailable" }));
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void tick(), 10000);
  timer.unref();
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
