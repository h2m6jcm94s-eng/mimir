CREATE TABLE IF NOT EXISTS "budget" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"daily_budget_usd" integer DEFAULT 0 NOT NULL,
	"monthly_budget_usd" integer DEFAULT 0 NOT NULL,
	"throttle_threshold" numeric(3, 2) DEFAULT '0.8' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "budget" ADD CONSTRAINT "budget_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Row-level security
ALTER TABLE "budget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "budget" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budget_isolation" ON "budget";
CREATE POLICY "budget_isolation" ON "budget"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "budget" TO mimir_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mimir_app;
