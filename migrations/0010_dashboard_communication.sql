CREATE TABLE IF NOT EXISTS lesson_series (
 id serial PRIMARY KEY, actor_id integer NOT NULL REFERENCES users(id), student_id integer NOT NULL REFERENCES users(id),
 request_key uuid NOT NULL UNIQUE, payload_hash text NOT NULL, timezone text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS series_id integer REFERENCES lesson_series(id);
CREATE UNIQUE INDEX IF NOT EXISTS lessons_series_occurrence_idx ON lessons(series_id,starts_at) WHERE series_id IS NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS request_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS messages_request_idx ON messages(sender_id,request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(sender_id,recipient_id,id DESC);
CREATE TABLE IF NOT EXISTS ai_request_usage (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);

CREATE OR REPLACE FUNCTION academy_notify_portal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recipient integer; message_key text; summary text:='';
BEGIN
 IF TG_TABLE_NAME='messages' THEN recipient:=NEW.recipient_id;message_key:='notify_message';summary:=NEW.subject;
 ELSIF TG_TABLE_NAME='lessons' THEN
  IF TG_OP='UPDATE' AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at AND NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.homework IS NOT DISTINCT FROM OLD.homework AND NEW.feedback IS NOT DISTINCT FROM OLD.feedback THEN RETURN NEW; END IF;
  recipient:=NEW.student_id;message_key:='notify_lesson';summary:=NEW.title;
 ELSE SELECT student_id INTO recipient FROM enrollments WHERE id=NEW.enrollment_id;message_key:='notify_curriculum'; END IF;
 INSERT INTO notifications(user_id,title,body) VALUES(recipient,message_key,summary);
 RETURN NEW;
END; $$;
