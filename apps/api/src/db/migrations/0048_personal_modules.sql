DO $$ BEGIN
  CREATE TYPE "public"."personal_module_kind" AS ENUM('finance', 'nutrition', 'fitness', 'travel', 'tutor', 'meeting', 'email', 'screenTime', 'conversation', 'suggestion', 'family', 'hr');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."personal_module_status" AS ENUM('active', 'done', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "personal_module" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "public"."tenant"("id") ON DELETE cascade,
  "kind" "personal_module_kind" NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" "personal_module_status" DEFAULT 'active' NOT NULL,
  "due_at" timestamp with time zone,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "personal_module_tenant_kind_status_idx" ON "personal_module" USING btree ("tenant_id", "kind", "status");
CREATE INDEX IF NOT EXISTS "personal_module_tenant_created_idx" ON "personal_module" USING btree ("tenant_id", "created_at" DESC);

ALTER TABLE "personal_module" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_module" FORCE ROW LEVEL SECURITY;

CREATE POLICY "personal_module_tenant_isolation" ON "personal_module"
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "personal_module" TO mimir_app;
