-- Life admin tracker: recurring personal responsibilities and deadlines.

DO $$ BEGIN
  CREATE TYPE "public"."life_admin_recurrence" AS ENUM('none', 'daily', 'weekly', 'monthly', 'yearly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."life_admin_status" AS ENUM('pending', 'done');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "life_admin_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "due_date" timestamp with time zone NOT NULL,
  "recurrence" "life_admin_recurrence" DEFAULT 'none' NOT NULL,
  "category" text,
  "status" "life_admin_status" DEFAULT 'pending' NOT NULL,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "tier" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "life_admin_item" ADD CONSTRAINT "life_admin_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "life_admin_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "life_admin_item" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "life_admin_item_isolation" ON "life_admin_item";
CREATE POLICY "life_admin_item_isolation" ON "life_admin_item"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS "idx_life_admin_item_tenant_due_date" ON "life_admin_item" USING btree ("tenant_id", "due_date");

-- The application role needs full access. When run as a privileged user this
-- grants privileges; when run as mimir_app itself the grant is a no-op.
DO $$
BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "life_admin_item" TO mimir_app';
  EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mimir_app';
EXCEPTION
  WHEN insufficient_privilege THEN null;
END
$$;
