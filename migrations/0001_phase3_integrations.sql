CREATE TABLE "integration_classroom_links" (
  "enrollment_id" integer PRIMARY KEY NOT NULL,
  "course_id" text NOT NULL,
  "state" text DEFAULT 'pending' NOT NULL,
  "invitation_id" text,
  "error" text
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
  "provider" text PRIMARY KEY NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "secret" text,
  "last_success" timestamp with time zone,
  "error" text,
  CONSTRAINT "integration_provider_check" CHECK ("integration_connections"."provider" in ('zoom','calendar','classroom','drive'))
);
--> statement-breakpoint
CREATE TABLE "integration_drive_resources" (
  "material_id" integer PRIMARY KEY NOT NULL,
  "file_id" text NOT NULL,
  "checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_jobs" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "kind" text NOT NULL,
  "resource_id" integer NOT NULL,
  "state" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "error" text,
  "next_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "integration_jobs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "integration_meetings" (
  "key" text PRIMARY KEY NOT NULL,
  "zoom_id" text,
  "join_url" text,
  "create_state" text DEFAULT 'new' NOT NULL,
  "calendar_id" text,
  "calendar_container" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_oauth_states" (
  "hash" text PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "session_hash" text NOT NULL,
  "provider" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "integration_jobs_due_idx" ON "integration_jobs" USING btree ("state","next_at");