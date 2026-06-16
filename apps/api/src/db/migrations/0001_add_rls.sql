-- Row-level security policies for multi-tenant isolation.
-- These are applied on top of the Drizzle-generated schema migration.

ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant" FORCE ROW LEVEL SECURITY;
ALTER TABLE "app_user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_user" FORCE ROW LEVEL SECURITY;
ALTER TABLE "node" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "node" FORCE ROW LEVEL SECURITY;
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session" FORCE ROW LEVEL SECURITY;
ALTER TABLE "message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "tenant";
CREATE POLICY "tenant_isolation" ON "tenant"
  USING (id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS "app_user_isolation" ON "app_user";
CREATE POLICY "app_user_isolation" ON "app_user"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS "node_isolation" ON "node";
CREATE POLICY "node_isolation" ON "node"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS "session_isolation" ON "session";
CREATE POLICY "session_isolation" ON "session"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS "message_isolation" ON "message";
CREATE POLICY "message_isolation" ON "message"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS "idx_user_tenant" ON "app_user" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_node_tenant" ON "node" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_session_tenant" ON "session" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_message_session" ON "message" USING btree ("session_id");
CREATE INDEX IF NOT EXISTS "idx_message_tenant" ON "message" USING btree ("tenant_id");
