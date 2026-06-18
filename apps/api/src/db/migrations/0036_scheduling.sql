-- Resource-aware scheduling (F-042) Phase 1.

DO $$ BEGIN
  CREATE TYPE "public"."scheduling_project_status" AS ENUM('active', 'completed', 'on_hold', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "client" text NOT NULL DEFAULT '',
  "deadline" timestamp with time zone,
  "status" "scheduling_project_status" NOT NULL DEFAULT 'active',
  "estimated_hours" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "resource" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "role" text NOT NULL DEFAULT '',
  "weekly_capacity_hours" integer NOT NULL DEFAULT 40,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "schedule_assignment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "resource_id" uuid NOT NULL,
  "week_starting" date NOT NULL,
  "allocated_hours" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "project" ADD CONSTRAINT "project_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "resource" ADD CONSTRAINT "resource_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "schedule_assignment" ADD CONSTRAINT "schedule_assignment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "schedule_assignment" ADD CONSTRAINT "schedule_assignment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "schedule_assignment" ADD CONSTRAINT "schedule_assignment_resource_id_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resource"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "project_tenant_status_idx" ON "project" USING btree ("tenant_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_tenant_idx" ON "resource" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_assignment_tenant_week_idx" ON "schedule_assignment" USING btree ("tenant_id", "week_starting");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_assignment_resource_week_idx" ON "schedule_assignment" USING btree ("resource_id", "week_starting");
--> statement-breakpoint

ALTER TABLE "project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project" FORCE ROW LEVEL SECURITY;
ALTER TABLE "resource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resource" FORCE ROW LEVEL SECURITY;
ALTER TABLE "schedule_assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "schedule_assignment" FORCE ROW LEVEL SECURITY;

CREATE POLICY "project_tenant_isolation" ON "project"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

CREATE POLICY "resource_tenant_isolation" ON "resource"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

CREATE POLICY "schedule_assignment_tenant_isolation" ON "schedule_assignment"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "project" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "resource" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "schedule_assignment" TO mimir_app;
