-- No-code tool builder (F-039) Phase 1.

DO $$ BEGIN
  CREATE TYPE "public"."tool_status" AS ENUM('draft', 'active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tool" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "status" "tool_status" NOT NULL DEFAULT 'draft',
  "action" text NOT NULL,
  "fields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "tool" ADD CONSTRAINT "tool_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tool_tenant_status_idx" ON "tool" USING btree ("tenant_id", "status");
--> statement-breakpoint

ALTER TABLE "tool" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tool" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tool_tenant_isolation" ON "tool"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tool" TO mimir_app;
