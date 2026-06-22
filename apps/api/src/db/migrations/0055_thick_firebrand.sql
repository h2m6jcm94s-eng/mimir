DO $$ BEGIN
 CREATE TYPE "public"."remediation_status" AS ENUM('pending', 'running', 'resolved', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "remediation_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"issue" text NOT NULL,
	"action" text,
	"status" "remediation_status" DEFAULT 'pending' NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "remediation_run" ADD CONSTRAINT "remediation_run_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "remediation_run_tenant_status_idx" ON "remediation_run" USING btree ("tenant_id","status");
--> statement-breakpoint
ALTER TABLE "remediation_run" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "remediation_run" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "remediation_run_tenant_isolation" ON "remediation_run";
--> statement-breakpoint
CREATE POLICY "remediation_run_tenant_isolation" ON "remediation_run"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "remediation_run" TO mimir_app';
  EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mimir_app';
EXCEPTION
  WHEN insufficient_privilege THEN null;
END
$$;
