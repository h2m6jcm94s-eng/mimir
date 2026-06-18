-- Fencing metadata for leader/fencing (F-011).
CREATE TABLE "mesh_meta" (
  "tenant_id" uuid PRIMARY KEY REFERENCES "tenant"("id") ON DELETE CASCADE,
  "leader" uuid REFERENCES "node"("id") ON DELETE SET NULL,
  "epoch" bigint NOT NULL DEFAULT 0,
  "min_epoch" bigint NOT NULL DEFAULT 0
);

ALTER TABLE "mesh_meta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mesh_meta" FORCE ROW LEVEL SECURITY;

CREATE POLICY "mesh_meta_tenant_isolation" ON "mesh_meta"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON TABLE "mesh_meta" TO mimir_app;
