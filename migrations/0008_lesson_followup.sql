CREATE TABLE IF NOT EXISTS lesson_followups (
 id bigserial PRIMARY KEY,
 lesson_id integer NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
 student_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 actor_id integer REFERENCES users(id) ON DELETE SET NULL,
 request_key uuid NOT NULL UNIQUE,
 payload_hash text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('report','issue')),
 issue_kind text CHECK (issue_kind IN ('reminder','absence_first','absence_second','absence_third','apologized','early_leave','instructor_late')),
 covered text NOT NULL DEFAULT '' CHECK (char_length(covered)<=3000),
 adjust_plan boolean NOT NULL DEFAULT false,
 behavior integer CHECK (behavior BETWEEN 1 AND 5),
 participation integer CHECK (participation BETWEEN 1 AND 5),
 comment text NOT NULL DEFAULT '' CHECK (char_length(comment)<=3000),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((kind='report' AND behavior IS NOT NULL AND participation IS NOT NULL AND issue_kind IS NULL AND char_length(covered)>0) OR (kind='issue' AND issue_kind IS NOT NULL AND behavior IS NULL AND participation IS NULL))
);
CREATE INDEX IF NOT EXISTS lesson_followup_student_idx ON lesson_followups(student_id,created_at DESC);
CREATE INDEX IF NOT EXISTS lesson_followup_lesson_idx ON lesson_followups(lesson_id,created_at DESC);

-- Retrying an unchanged schedule or saving unchanged feedback must not send duplicates.
CREATE OR REPLACE FUNCTION academy_notify_portal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recipient integer; message_key text; summary text:='';
BEGIN
 IF TG_TABLE_NAME='messages' THEN recipient:=NEW.recipient_id;message_key:='notify_message';
 ELSIF TG_TABLE_NAME='lessons' THEN
  IF TG_OP='UPDATE' AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.homework IS NOT DISTINCT FROM OLD.homework AND NEW.feedback IS NOT DISTINCT FROM OLD.feedback THEN RETURN NEW; END IF;
  recipient:=NEW.student_id;message_key:='notify_lesson';summary:=NEW.title;
 ELSE SELECT student_id INTO recipient FROM enrollments WHERE id=NEW.enrollment_id;message_key:='notify_curriculum'; END IF;
 INSERT INTO notifications(user_id,title,body) VALUES(recipient,message_key,summary);
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS academy_lesson_notification ON lessons;
CREATE TRIGGER academy_lesson_notification AFTER INSERT OR UPDATE OF starts_at,ends_at,status,homework,feedback ON lessons FOR EACH ROW EXECUTE FUNCTION academy_notify_portal();
