CREATE TABLE IF NOT EXISTS "local_model_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"base_url" text DEFAULT 'http://localhost:11434' NOT NULL,
	"chat_model" text DEFAULT 'llama3.1' NOT NULL,
	"embedding_model" text DEFAULT 'nomic-embed-text' NOT NULL,
	"embedding_dimension" integer DEFAULT 768 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "local_model_config" ADD CONSTRAINT "local_model_config_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "local_model_config_tenant_idx" ON "local_model_config" USING btree ("tenant_id");

ALTER TABLE "local_model_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "local_model_config" FORCE ROW LEVEL SECURITY;

CREATE POLICY "local_model_config_tenant_isolation" ON "local_model_config"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "local_model_config" TO mimir_app;