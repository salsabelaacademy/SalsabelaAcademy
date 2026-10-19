import { emailErrorCode, emailErrorCodes } from "./email-errors";
import { Resend } from "resend";
import { pool } from "./db";
import { brandedEmail } from "./email-template";
import { lessonMail } from '../shared/lesson-mail';
import { followupTranslations } from '../shared/lesson-followup';
import { lessonDashboard, lessonJoinPath } from '../shared/lesson-links';
import { reminderDeliveryState } from './lesson-reminders';
export function emailReady(env = process.env) {
  try {
    const u = new URL(env.FRONTEND_URL || "");
    return Boolean(
      env.RESEND_API_KEY?.trim() &&
      env.RESEND_FROM?.trim() &&
      u.protocol === "https:",
    );
  } catch {
    return false;
  }
}
export function notificationEmail(row: any, origin: string) {
  const ar = ["ar", "arabic"].includes(String(row.language).toLowerCase()),
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
  const copy=lessonMail[lang],followup=followupTranslations[lang];
  const reminder=['lesson_reminder_before','lesson_reminder_start'].includes(ctx.kind);
  const report=ctx.kind==='lesson_report',issue=ctx.kind==='lesson_issue';
  if(reminder||report||issue){
    const remaining=Math.max(1,Math.min(10,Math.ceil((Date.parse(ctx.startsAt)-Date.now())/60000)||10));
    const beforeTitle=remaining===1?copy.beforeOne:remaining===2?copy.beforeTwo:copy.beforeMinutes.replace('{{minutes}}',new Intl.NumberFormat(lang).format(remaining));
    const title=report?copy.report:issue?copy.issue:ctx.kind==='lesson_reminder_before'?beforeTitle:copy.start;
    let body=report?copy.reportBody:issue?copy.issueBody:ctx.kind==='lesson_reminder_before'?copy.beforeBody:row.reminderCanJoin?copy.startBody:copy.pendingBody;
    if(report){
      body+='\n\n'+followup.covered+'\n'+String(ctx.covered||'');
      if(ctx.adjustPlan)body+='\n\n'+followup.adjustPlan;
      details.push({label:followup.behavior,value:String(ctx.behavior)+'/5'},{label:followup.participation,value:String(ctx.participation)+'/5'});
    }
    if(issue)body+='\n\n'+(followup[ctx.issueKind as keyof typeof followup]||followup.issueReceived);
    if((report||issue)&&ctx.comment)body+='\n\n'+followup.comment+'\n'+ctx.comment;
    details.unshift({label:words.title,value:String(ctx.lessonTitle||row.body||'')});
    if(row.role==='admin'&&ctx.studentName)details.push({label:copy.student,value:String(ctx.studentName)});
    const direct=ctx.kind==='lesson_reminder_start'&&row.reminderCanJoin;
    const url=origin+(direct?lessonJoinPath(ctx.lessonId,ctx.startsAt,lang):lessonDashboard(ctx.lessonId,row.role,lang));
    return {subject:title,...brandedEmail({title,body,language:lang,name:row.name,url,button:direct?copy.join:copy.dashboard,details},origin)};
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
      `SELECT n.title,n.body,n.context,u.id AS user_id,u.name,u.email,u.role,u.status,CASE WHEN u.role='student' THEN COALESCE(NULLIF(s.preferred_language,''),a.preferred_language,'en') ELSE COALESCE(a.preferred_language,'en') END AS language,CASE WHEN u.role='student' THEN COALESCE(NULLIF(s.timezone,''),a.timezone,'UTC') ELSE COALESCE(a.timezone,'UTC') END AS timezone,COALESCE(p.email_updates,true) AS enabled FROM notifications n JOIN users u ON u.id::text=n.user_id::text LEFT JOIN account_details a ON a.user_id::text=u.id::text LEFT JOIN student_profiles s ON s.user_id::text=u.id::text LEFT JOIN account_preferences p ON p.user_id::text=u.id::text WHERE n.id=$1 AND n.created_at>now()-interval '23 hours'`,
      [job.notification_id],
    );
    const row = result.rows[0];
    const reminderState = row ? await reminderDeliveryState(row) : {eligible:false,canJoin:false};
    if (!row || row.status !== "active" || !row.enabled || !reminderState.eligible) {
      await pool.query(
        "UPDATE email_deliveries SET status='skipped' WHERE id=$1",
        [job.id],
      );
      return true;
    }
    const draft = {
      from: process.env.RESEND_FROM!,
      to: row.email,
      ...notificationEmail({...row,reminderCanJoin:reminderState.canJoin}, new URL(process.env.FRONTEND_URL!).origin),
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
    if (sent.error || !sent.data?.id) throw Error(emailErrorCode(sent.error));
    await pool.query(
      "UPDATE email_deliveries SET status='sent',last_error=NULL WHERE id=$1",
      [job.id],
    );
  } catch (error) {
    const code =
      error instanceof Error &&
      (emailErrorCodes as readonly string[]).includes(error.message)
        ? error.message
        : "email_delivery_failed";
    await pool.query(
      "UPDATE email_deliveries SET status=CASE WHEN attempts>=5 THEN 'failed' ELSE 'pending' END,next_attempt=now()+interval '1 minute'*power(2,attempts),last_error=$2 WHERE id=$1",
      [job.id, code],
    );
    console.warn(
      JSON.stringify({ event: "email_delivery_failed", jobId: job.id, code }),
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
