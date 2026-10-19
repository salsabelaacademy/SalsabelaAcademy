-- Durable deduplication per scheduled instant and recipient, including legacy text user IDs.
CREATE TABLE IF NOT EXISTS public.lesson_reminder_dispatches (
 lesson_id integer NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
 starts_at timestamptz NOT NULL,
 recipient_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('before','start')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(lesson_id,starts_at,recipient_id,kind)
);
CREATE INDEX IF NOT EXISTS lessons_reminder_due_idx ON public.lessons(starts_at) WHERE status='scheduled';
