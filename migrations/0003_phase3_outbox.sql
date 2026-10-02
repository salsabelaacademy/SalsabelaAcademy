ALTER TABLE "integration_meetings" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_job_kind_check" CHECK ("integration_jobs"."kind" in ('lesson','appointment','classroom'));--> statement-breakpoint
ALTER TABLE "integration_jobs" ADD CONSTRAINT "integration_job_state_check" CHECK ("integration_jobs"."state" in ('pending','running','succeeded','failed'));
--> statement-breakpoint
-- Transactional outbox: a committed schedule change always creates work, even
-- if the HTTP process crashes before it can enqueue explicitly.
CREATE FUNCTION academy_schedule_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE resource_kind text;
BEGIN
  resource_kind := CASE WHEN TG_TABLE_NAME = 'lessons' THEN 'lesson' ELSE 'appointment' END;
  INSERT INTO integration_jobs(key,kind,resource_id)
    VALUES(resource_kind || ':' || NEW.id, resource_kind, NEW.id)
    ON CONFLICT(key) DO UPDATE SET state='pending',attempts=0,error=NULL,
      next_at=now(),updated_at=now(),generation=integration_jobs.generation+1;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER lesson_integration_outbox AFTER INSERT OR UPDATE OF starts_at,ends_at,status,title ON lessons FOR EACH ROW EXECUTE FUNCTION academy_schedule_outbox();
--> statement-breakpoint
CREATE TRIGGER appointment_integration_outbox AFTER INSERT OR UPDATE OF starts_at,ends_at,status,original_timezone ON appointments FOR EACH ROW EXECUTE FUNCTION academy_schedule_outbox();
