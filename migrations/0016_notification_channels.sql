-- Keep chat notifications in-app/Web Push. Preserve legacy text/integer IDs.
CREATE OR REPLACE FUNCTION public.academy_email_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT COALESCE((NEW.title IN ('notify_assessment','notify_enrollment','notify_report','notify_issue','notify_reminder_before','notify_reminder_start','notify_application','notify_contact','notify_security_login','notify_security_password') OR (NEW.title='notify_lesson' AND NEW.context->>'change' IN ('scheduled','rescheduled','cancelled'))),false) THEN RETURN NEW; END IF;
 INSERT INTO public.email_deliveries(notification_id)
 SELECT NEW.id FROM public.users u
 LEFT JOIN public.account_preferences p ON p.user_id::text=u.id::text
 WHERE u.id::text=NEW.user_id::text AND u.status='active'
 AND (NEW.title IN ('notify_security_login','notify_security_password') OR COALESCE(p.email_updates,true))
 ON CONFLICT(notification_id) DO NOTHING;
 RETURN NEW;
END; $$;
-- Preserve delivery history; suppress only unsent non-email events.
UPDATE public.email_deliveries e SET status='skipped',last_error=NULL
FROM public.notifications n WHERE e.notification_id=n.id
 AND e.status IN ('pending','sending','failed') AND NOT COALESCE((n.title IN ('notify_assessment','notify_enrollment','notify_report','notify_issue','notify_reminder_before','notify_reminder_start','notify_application','notify_contact','notify_security_login','notify_security_password') OR (n.title='notify_lesson' AND n.context->>'change' IN ('scheduled','rescheduled','cancelled'))),false);
