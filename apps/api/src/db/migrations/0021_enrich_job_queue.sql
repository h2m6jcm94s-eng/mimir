-- Enrich the job table for P0 durable queue semantics (F-007).
ALTER TABLE "job"
  ADD COLUMN IF NOT EXISTS "priority" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "retry_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "max_retries" integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "finished_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "error_code" varchar(64),
  ADD COLUMN IF NOT EXISTS "error_message" text;

CREATE INDEX IF NOT EXISTS "idx_job_tenant_status" ON "job" ("tenant_id", "status");
