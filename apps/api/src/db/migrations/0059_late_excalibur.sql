DO $$ BEGIN
 CREATE TYPE "public"."job_source" AS ENUM('chat', 'api', 'ui', 'routine');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "source" "job_source" DEFAULT 'api' NOT NULL;