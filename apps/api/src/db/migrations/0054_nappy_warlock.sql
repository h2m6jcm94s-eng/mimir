DO $$ BEGIN
 CREATE TYPE "public"."skill_draft_status" AS ENUM('draft', 'published', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "skill_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"prompt" text NOT NULL,
	"code" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "skill_draft_status" DEFAULT 'draft' NOT NULL,
	"installs" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "skill_draft" ADD CONSTRAINT "skill_draft_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "skill_draft_tenant_status_idx" ON "skill_draft" USING btree ("tenant_id","status");
--> statement-breakpoint
ALTER TABLE "skill_draft" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "skill_draft_tenant_isolation" ON "skill_draft";
--> statement-breakpoint
CREATE POLICY "skill_draft_tenant_isolation" ON "skill_draft"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "skill_draft" TO mimir_app';
  EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mimir_app';
EXCEPTION
  WHEN insufficient_privilege THEN null;
END
$$;
