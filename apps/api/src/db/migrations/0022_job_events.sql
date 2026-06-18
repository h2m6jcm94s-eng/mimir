-- Persisted job lifecycle events for the F-006 event bus.
CREATE TYPE "job_event_type" AS ENUM (
  'job.created',
  'job.queued',
  'job.blocked',
  'job.running',
  'job.build.completed',
  'job.review.completed',
  'job.patch.applied',
  'job.apply.completed',
  'job.apply.failed',
  'job.done',
  'job.failed',
  'job.cancelled',
  'job.retried',
  'job.status_updated',
  'job.approval.requested'
);

CREATE TABLE "job_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
  "job_id" uuid NOT NULL REFERENCES "job"("id") ON DELETE CASCADE,
  "type" "job_event_type" NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_job_event_tenant_job" ON "job_event" ("tenant_id", "job_id", "created_at" DESC);
CREATE INDEX "idx_job_event_tenant_created" ON "job_event" ("tenant_id", "created_at" DESC);

ALTER TABLE "job_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job_event" FORCE ROW LEVEL SECURITY;

CREATE POLICY "job_event_tenant_isolation" ON "job_event"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
