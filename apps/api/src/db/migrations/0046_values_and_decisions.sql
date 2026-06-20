CREATE TABLE IF NOT EXISTS "value_statement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"app_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"weight" integer DEFAULT 5 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"app_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"context" text DEFAULT '' NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chosen_option" text NOT NULL,
	"value_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "decision_outcome" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"alignment_score" integer,
	"notes" text DEFAULT '' NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_statement" ADD CONSTRAINT "value_statement_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "value_statement" ADD CONSTRAINT "value_statement_app_user_id_app_user_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision" ADD CONSTRAINT "decision_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision" ADD CONSTRAINT "decision_app_user_id_app_user_id_fk" FOREIGN KEY ("app_user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_outcome" ADD CONSTRAINT "decision_outcome_decision_id_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."decision"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "value_statement_user_idx" ON "value_statement" USING btree ("tenant_id","app_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "value_statement_active_name_idx" ON "value_statement" USING btree ("tenant_id","app_user_id","name") WHERE "active" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_user_idx" ON "decision" USING btree ("tenant_id","app_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_decided_at_idx" ON "decision" USING btree ("decided_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "decision_outcome_decision_idx" ON "decision_outcome" USING btree ("decision_id");

ALTER TABLE "value_statement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "value_statement" FORCE ROW LEVEL SECURITY;
ALTER TABLE "decision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decision" FORCE ROW LEVEL SECURITY;
ALTER TABLE "decision_outcome" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "decision_outcome" FORCE ROW LEVEL SECURITY;

CREATE POLICY "value_statement_tenant_isolation" ON "value_statement"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

CREATE POLICY "decision_tenant_isolation" ON "decision"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

CREATE POLICY "decision_outcome_tenant_isolation" ON "decision_outcome"
  USING ("decision_id" IN (
    SELECT "id" FROM "decision" WHERE "tenant_id" = current_setting('app.tenant_id')::uuid
  ))
  WITH CHECK ("decision_id" IN (
    SELECT "id" FROM "decision" WHERE "tenant_id" = current_setting('app.tenant_id')::uuid
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "value_statement" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "decision" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "decision_outcome" TO mimir_app;
