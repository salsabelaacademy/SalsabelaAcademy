CREATE TABLE IF NOT EXISTS push_subscriptions (
 id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth text NOT NULL,
 language text NOT NULL CHECK(language IN ('ar','en')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscription_user_idx ON push_subscriptions(user_id);
CREATE TABLE IF NOT EXISTS push_deliveries (
 id bigserial PRIMARY KEY, notification_id integer NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
 subscription_id integer NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
 attempts integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'pending',
 next_attempt timestamptz NOT NULL DEFAULT now(), last_error text,
 UNIQUE(notification_id,subscription_id)
);
CREATE INDEX IF NOT EXISTS push_pending_idx ON push_deliveries(next_attempt) WHERE status='pending';
CREATE OR REPLACE FUNCTION academy_push_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO push_deliveries(notification_id,subscription_id)
 SELECT NEW.id,id FROM push_subscriptions WHERE user_id=NEW.user_id;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS academy_push_notification ON notifications;
CREATE TRIGGER academy_push_notification AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION academy_push_outbox();
-- New application/contact messages notify the sole administrator.
CREATE OR REPLACE FUNCTION academy_admin_inbox_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO notifications(user_id,title,body)
 SELECT id,CASE WHEN TG_TABLE_NAME='platform_applications' THEN 'notify_application' ELSE 'notify_contact' END,'' FROM users WHERE role='admin' AND status='active';
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS academy_application_notice ON platform_applications;
CREATE TRIGGER academy_application_notice AFTER INSERT ON platform_applications FOR EACH ROW EXECUTE FUNCTION academy_admin_inbox_notice();
DROP TRIGGER IF EXISTS academy_contact_notice ON contact_messages;
CREATE TRIGGER academy_contact_notice AFTER INSERT ON contact_messages FOR EACH ROW EXECUTE FUNCTION academy_admin_inbox_notice();
