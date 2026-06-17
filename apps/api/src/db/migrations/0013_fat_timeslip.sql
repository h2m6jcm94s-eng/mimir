DO $$ BEGIN
 CREATE TYPE "public"."connector_kind" AS ENUM('github');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."connector_status" AS ENUM('connected', 'disconnected', 'error');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connector" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "connector_kind" NOT NULL,
	"account" text,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"tier" integer DEFAULT 1 NOT NULL,
	"status" "connector_status" DEFAULT 'disconnected' NOT NULL,
	"secret_ref" text,
	"last_sync" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "connector" ADD CONSTRAINT "connector_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connector_tenant_id_idx" ON "connector" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "connector_tenant_kind_idx" ON "connector" ("tenant_id", "kind");
--> statement-breakpoint
ALTER TABLE "connector" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "connector" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "connector_isolation" ON "connector"
  FOR ALL
  TO PUBLIC
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "connector" TO mimir_app;
