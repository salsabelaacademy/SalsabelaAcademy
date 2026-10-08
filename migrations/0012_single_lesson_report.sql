-- Run inside a migration transaction. Block writers during historical backfill.
LOCK TABLE lesson_followups IN SHARE ROW EXCLUSIVE MODE;
-- Preserve every historical report; reserve its lesson against another report.
CREATE TABLE IF NOT EXISTS lesson_report_claims (
  lesson_id integer PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
  claimed_at timestamp NOT NULL DEFAULT now()
);
INSERT INTO lesson_report_claims(lesson_id,claimed_at)
SELECT lesson_id,min(created_at) FROM lesson_followups WHERE kind='report' GROUP BY lesson_id
ON CONFLICT(lesson_id) DO NOTHING;
CREATE OR REPLACE FUNCTION academy_claim_lesson_report() RETURNS trigger AS $$
BEGIN
  IF NEW.kind='report' AND (TG_OP='INSERT' OR OLD.kind IS DISTINCT FROM NEW.kind OR OLD.lesson_id IS DISTINCT FROM NEW.lesson_id) THEN
    INSERT INTO lesson_report_claims(lesson_id) VALUES(NEW.lesson_id) ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A report already exists for this lesson' USING ERRCODE='23505',CONSTRAINT='lesson_report_once';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS academy_single_lesson_report ON lesson_followups;
CREATE TRIGGER academy_single_lesson_report BEFORE INSERT OR UPDATE OF kind,lesson_id ON lesson_followups FOR EACH ROW EXECUTE FUNCTION academy_claim_lesson_report();
