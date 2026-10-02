CREATE TABLE IF NOT EXISTS academy_settings (id integer PRIMARY KEY DEFAULT 1 CHECK(id=1), public_name text NOT NULL DEFAULT 'Salsabela Academy', contact_email text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO academy_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS contact_messages (id serial PRIMARY KEY, name text NOT NULL, email text NOT NULL, subject text NOT NULL, message text NOT NULL, fingerprint text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS contact_messages_created_idx ON contact_messages(created_at);
CREATE TABLE IF NOT EXISTS academy_audit (id serial PRIMARY KEY, actor_id integer REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL, resource text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public_request_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE OR REPLACE FUNCTION academy_notify_portal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recipient integer; message_key text;
BEGIN
 IF TG_TABLE_NAME='messages' THEN recipient:=NEW.recipient_id;message_key:='notify_message';
 ELSIF TG_TABLE_NAME='lessons' THEN recipient:=NEW.student_id;message_key:='notify_lesson';
 ELSE SELECT student_id INTO recipient FROM enrollments WHERE id=NEW.enrollment_id;message_key:='notify_curriculum'; END IF;
 INSERT INTO notifications(user_id,title,body) VALUES(recipient,message_key,'');
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS academy_message_notification ON messages;
CREATE TRIGGER academy_message_notification AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION academy_notify_portal();
DROP TRIGGER IF EXISTS academy_lesson_notification ON lessons;
CREATE TRIGGER academy_lesson_notification AFTER INSERT OR UPDATE OF starts_at,status,homework,feedback ON lessons FOR EACH ROW EXECUTE FUNCTION academy_notify_portal();
DROP TRIGGER IF EXISTS academy_curriculum_notification ON student_progress;
CREATE TRIGGER academy_curriculum_notification AFTER INSERT OR UPDATE OF completion_status ON student_progress FOR EACH ROW EXECUTE FUNCTION academy_notify_portal();
