-- Row-level security for the job table created in migration 0002.
ALTER TABLE "job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "job" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_isolation" ON "job";
CREATE POLICY "job_isolation" ON "job"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS "idx_job_tenant" ON "job" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_job_idempotency" ON "job" USING btree ("idempotency_key");
