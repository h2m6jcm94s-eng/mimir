-- Second brain / idea capture (F-071).
ALTER TYPE "knowledge_kind" ADD VALUE IF NOT EXISTS 'note';

CREATE TABLE "knowledge_link" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
  "source_id" uuid NOT NULL REFERENCES "knowledge_item"("id") ON DELETE CASCADE,
  "target_id" uuid NOT NULL REFERENCES "knowledge_item"("id") ON DELETE CASCADE,
  "kind" text NOT NULL DEFAULT 'link',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "knowledge_link" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_link" FORCE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_link_tenant_isolation" ON "knowledge_link"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "knowledge_link" TO mimir_app;
