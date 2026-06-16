-- Row-level security for the audit log.

ALTER TABLE "audit_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_event" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_event_isolation" ON "audit_event";
CREATE POLICY "audit_event_isolation" ON "audit_event"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS "idx_audit_event_tenant_ts" ON "audit_event" USING btree ("tenant_id", "ts");
