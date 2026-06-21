DO $$ BEGIN
 CREATE TYPE "public"."model_invocation_status" AS ENUM('success', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_invocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"tier" integer NOT NULL,
	"status" "model_invocation_status" NOT NULL,
	"latency_ms" integer,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"cost_usd" numeric(18, 8),
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_invocation" ADD CONSTRAINT "model_invocation_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "model_invocation_tenant_created_idx" ON "model_invocation" USING btree ("tenant_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "model_invocation_tenant_provider_model_idx" ON "model_invocation" USING btree ("tenant_id", "provider", "model");

ALTER TABLE "model_invocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_invocation" FORCE ROW LEVEL SECURITY;

CREATE POLICY "model_invocation_tenant_isolation" ON "model_invocation"
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT ON TABLE "model_invocation" TO mimir_app;
