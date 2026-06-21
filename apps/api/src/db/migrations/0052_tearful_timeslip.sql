CREATE TABLE IF NOT EXISTS "screen_time_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"date" date NOT NULL,
	"app" text,
	"category" text,
	"minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "screen_time_entry" ADD CONSTRAINT "screen_time_entry_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "screen_time_entry_tenant_date_idx" ON "screen_time_entry" USING btree ("tenant_id","date");
--> statement-breakpoint
ALTER TABLE "screen_time_entry" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "screen_time_entry_tenant_isolation" ON "screen_time_entry";
--> statement-breakpoint
CREATE POLICY "screen_time_entry_tenant_isolation" ON "screen_time_entry"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "screen_time_entry" TO mimir_app';
  EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mimir_app';
EXCEPTION
  WHEN insufficient_privilege THEN null;
END
$$;
