-- Daily briefing generator (F-063).
CREATE TYPE "briefing_kind" AS ENUM ('briefing', 'email', 'meeting');

CREATE TABLE "briefing" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
  "kind" "briefing_kind" NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "tier" integer NOT NULL DEFAULT 1,
  "confidence" real NOT NULL DEFAULT 0.9,
  "sources" integer,
  "payload" jsonb DEFAULT '{}',
  "pinned" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "briefing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "briefing" FORCE ROW LEVEL SECURITY;

CREATE POLICY "briefing_tenant_isolation" ON "briefing"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "briefing" TO mimir_app;
