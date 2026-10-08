CREATE TABLE IF NOT EXISTS account_preferences (user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,email_updates boolean NOT NULL DEFAULT true,updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS context jsonb;
CREATE TABLE IF NOT EXISTS email_deliveries (id bigserial PRIMARY KEY,notification_id integer NOT NULL UNIQUE REFERENCES notifications(id) ON DELETE CASCADE,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','skipped','failed')),attempts integer NOT NULL DEFAULT 0,next_attempt timestamptz NOT NULL DEFAULT now(),last_error text,payload jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS email_delivery_pending_idx ON email_deliveries(next_attempt) WHERE status IN ('pending','sending');
CREATE OR REPLACE FUNCTION academy_email_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO email_deliveries(notification_id) SELECT NEW.id FROM users u LEFT JOIN account_preferences p ON p.user_id=u.id WHERE u.id=NEW.user_id AND u.status='active' AND COALESCE(p.email_updates,true) ON CONFLICT DO NOTHING;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS academy_email_notification ON notifications;
CREATE TRIGGER academy_email_notification AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION academy_email_outbox();
CREATE OR REPLACE FUNCTION academy_notify_portal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recipient integer; message_key text; summary text:=''; details jsonb:=NULL;
BEGIN
 IF TG_TABLE_NAME='messages' THEN recipient:=NEW.recipient_id;message_key:='notify_message';summary:=NEW.subject;
 ELSIF TG_TABLE_NAME='lessons' THEN
  IF TG_OP='UPDATE' AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.homework IS NOT DISTINCT FROM OLD.homework AND NEW.feedback IS NOT DISTINCT FROM OLD.feedback THEN RETURN NEW; END IF;
  recipient:=NEW.student_id;message_key:='notify_lesson';summary:=NEW.title;
  details:=jsonb_build_object('lessonId',NEW.id,'startsAt',NEW.starts_at,'endsAt',NEW.ends_at,'status',NEW.status,'change',CASE WHEN TG_OP='INSERT' THEN 'scheduled' WHEN NEW.status IS DISTINCT FROM OLD.status THEN NEW.status WHEN NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN 'rescheduled' ELSE 'updated' END);
 ELSE SELECT student_id INTO recipient FROM enrollments WHERE id=NEW.enrollment_id;message_key:='notify_curriculum'; END IF;
 INSERT INTO notifications(user_id,title,body,context) VALUES(recipient,message_key,summary,details);
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION academy_assessment_email_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.student_id IS NULL OR NEW.status NOT IN ('confirmed','cancelled','completed','no_show') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 INSERT INTO notifications(user_id,title,body,context) VALUES(NEW.student_id,'notify_assessment','',jsonb_build_object('startsAt',NEW.starts_at,'endsAt',NEW.ends_at,'status',NEW.status,'change',CASE WHEN TG_OP='INSERT' THEN 'scheduled' WHEN NEW.status IS DISTINCT FROM OLD.status THEN NEW.status ELSE 'rescheduled' END));
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS academy_assessment_email ON appointments;
CREATE TRIGGER academy_assessment_email AFTER INSERT OR UPDATE OF starts_at,ends_at,status ON appointments FOR EACH ROW EXECUTE FUNCTION academy_assessment_email_notice();
CREATE OR REPLACE FUNCTION academy_enrollment_email_notice() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE program_name text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 SELECT name INTO program_name FROM programs WHERE id=NEW.program_id;
 INSERT INTO notifications(user_id,title,body) VALUES(NEW.student_id,'notify_enrollment',COALESCE(program_name,''));
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS academy_enrollment_email ON enrollments;
CREATE TRIGGER academy_enrollment_email AFTER INSERT OR UPDATE OF status ON enrollments FOR EACH ROW EXECUTE FUNCTION academy_enrollment_email_notice();
