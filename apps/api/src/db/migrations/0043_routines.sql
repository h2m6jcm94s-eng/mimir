CREATE TABLE IF NOT EXISTS "routine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cron" text NOT NULL,
	"job_type" text NOT NULL,
	"job_input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tier" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_run_status" text,
	"created_by" uuid,
	"policy_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routine_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"routine_id" uuid NOT NULL,
	"job_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine" ADD CONSTRAINT "routine_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine" ADD CONSTRAINT "routine_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine_run" ADD CONSTRAINT "routine_run_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine_run" ADD CONSTRAINT "routine_run_routine_id_routine_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routine"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine_run" ADD CONSTRAINT "routine_run_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routine_tenant_idx" ON "routine" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routine_tenant_enabled_idx" ON "routine" USING btree ("tenant_id","enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routine_run_routine_idx" ON "routine_run" USING btree ("routine_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routine_run_tenant_idx" ON "routine_run" USING btree ("tenant_id");

ALTER TABLE "routine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "routine" FORCE ROW LEVEL SECURITY;
ALTER TABLE "routine_run" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "routine_run" FORCE ROW LEVEL SECURITY;

CREATE POLICY "routine_tenant_isolation" ON "routine"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

CREATE POLICY "routine_run_tenant_isolation" ON "routine_run"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "routine" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "routine_run" TO mimir_app;