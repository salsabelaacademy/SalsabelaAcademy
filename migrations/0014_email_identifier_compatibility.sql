-- Existing installations may have text user identifiers alongside integer
-- notification/preference identifiers. Compare their textual representations;
-- do not change identifiers, rows, foreign keys or account ownership.
CREATE OR REPLACE FUNCTION public.academy_email_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO public.email_deliveries(notification_id)
 SELECT NEW.id
 FROM public.users u
 LEFT JOIN public.account_preferences p ON p.user_id::text = u.id::text
 WHERE u.id::text = NEW.user_id::text
   AND u.status = 'active'
   AND COALESCE(p.email_updates,true)
 ON CONFLICT(notification_id) DO NOTHING;
 RETURN NEW;
END; $$;
