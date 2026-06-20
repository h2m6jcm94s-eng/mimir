CREATE TYPE "email_digest_frequency" AS ENUM ('daily', 'weekly');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_digest_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"app_user_id" uuid NOT NULL,
	"frequency" "email_digest_frequency" DEFAULT 'daily' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"include_notifications" boolean DEFAULT true NOT NULL,
	"include_tasks" boolean DEFAULT true NOT NULL,
	"include_approvals" boolean DEFAULT true NOT NULL,
	"include_reports" boolean DEFAULT true NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_digest_preference" ADD CONSTRAINT "email_digest_preference_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_digest_preference" ADD CONSTRAINT "email_digest_preference_app_user_id_app_user_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_digest_preference_user_idx" ON "email_digest_preference" USING btree ("tenant_id","app_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_digest_preference_due_idx" ON "email_digest_preference" USING btree ("enabled","frequency","last_sent_at");

ALTER TABLE "email_digest_preference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_digest_preference" FORCE ROW LEVEL SECURITY;

CREATE POLICY "email_digest_preference_tenant_isolation" ON "email_digest_preference"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "email_digest_preference" TO mimir_app;
