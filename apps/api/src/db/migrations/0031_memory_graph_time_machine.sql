-- Graph memory + time-machine (F-016).

DO $$ BEGIN
  CREATE TYPE "public"."memory_node_kind" AS ENUM('semantic', 'episodic', 'procedural');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "memory_node" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "kind" "memory_node_kind" NOT NULL,
  "key" text NOT NULL,
  "value" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "valid_from" timestamp with time zone DEFAULT now() NOT NULL,
  "valid_to" timestamp with time zone,
  "created_by" uuid,
  "source_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "memory_edge" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "source_id" uuid NOT NULL,
  "target_id" uuid NOT NULL,
  "rel" text DEFAULT 'relates_to' NOT NULL,
  "weight" real DEFAULT 1 NOT NULL,
  "valid_from" timestamp with time zone DEFAULT now() NOT NULL,
  "valid_to" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "memory_checkpoint" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "label" text NOT NULL,
  "created_by" uuid,
  "parent_id" uuid,
  "node_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "edge_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "memory_node" ADD CONSTRAINT "memory_node_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "memory_node" ADD CONSTRAINT "memory_node_created_by_user_account_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_account"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "memory_edge" ADD CONSTRAINT "memory_edge_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "memory_edge" ADD CONSTRAINT "memory_edge_source_id_memory_node_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."memory_node"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "memory_edge" ADD CONSTRAINT "memory_edge_target_id_memory_node_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."memory_node"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "memory_checkpoint" ADD CONSTRAINT "memory_checkpoint_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "memory_checkpoint" ADD CONSTRAINT "memory_checkpoint_created_by_user_account_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_account"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "memory_checkpoint" ADD CONSTRAINT "memory_checkpoint_parent_id_memory_checkpoint_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."memory_checkpoint"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "memory_node_tenant_key_idx" ON "memory_node" USING btree ("tenant_id", "key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_node_valid_idx" ON "memory_node" USING btree ("tenant_id", "valid_from", "valid_to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_edge_source_idx" ON "memory_edge" USING btree ("tenant_id", "source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_edge_target_idx" ON "memory_edge" USING btree ("tenant_id", "target_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memory_checkpoint_parent_idx" ON "memory_checkpoint" USING btree ("tenant_id", "parent_id");
--> statement-breakpoint

ALTER TABLE "memory_node" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memory_node" FORCE ROW LEVEL SECURITY;
ALTER TABLE "memory_edge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memory_edge" FORCE ROW LEVEL SECURITY;
ALTER TABLE "memory_checkpoint" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memory_checkpoint" FORCE ROW LEVEL SECURITY;

CREATE POLICY "memory_node_tenant_isolation" ON "memory_node"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

CREATE POLICY "memory_edge_tenant_isolation" ON "memory_edge"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

CREATE POLICY "memory_checkpoint_tenant_isolation" ON "memory_checkpoint"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "memory_node" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "memory_edge" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "memory_checkpoint" TO mimir_app;
