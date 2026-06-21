CREATE TABLE IF NOT EXISTS "marketplace_install" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"item_id" text NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "marketplace_install" ADD CONSTRAINT "marketplace_install_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "marketplace_install" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "marketplace_install" FORCE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_install_tenant_isolation" ON "marketplace_install"
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, DELETE ON TABLE "marketplace_install" TO mimir_app;
