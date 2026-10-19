-- Only a repeated notification is idempotent. A primary-ID collision must not silently discard email.
CREATE OR REPLACE FUNCTION academy_email_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO email_deliveries(notification_id)
 SELECT NEW.id FROM users u LEFT JOIN account_preferences p ON p.user_id=u.id
 WHERE u.id=NEW.user_id AND u.status='active' AND COALESCE(p.email_updates,true)
 ON CONFLICT(notification_id) DO NOTHING;
 RETURN NEW;
END; $$;
