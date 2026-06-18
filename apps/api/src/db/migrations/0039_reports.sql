-- F-023 Reports: tenant-scoped report catalog.

DO $$ BEGIN
  CREATE TYPE "public"."report_kind" AS ENUM('security', 'cost', 'compliance');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."report_status" AS ENUM('ready', 'generating', 'scheduled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "report" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "kind" "report_kind" NOT NULL,
  "status" "report_status" NOT NULL DEFAULT 'scheduled',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "report" ADD CONSTRAINT "report_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "report_tenant_kind_idx" ON "report" USING btree ("tenant_id", "kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_tenant_status_idx" ON "report" USING btree ("tenant_id", "status");
--> statement-breakpoint

ALTER TABLE "report" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report" FORCE ROW LEVEL SECURITY;

CREATE POLICY "report_tenant_isolation" ON "report"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "report" TO mimir_app;
