CREATE TYPE "routine_source_format" AS ENUM ('native', 'n8n');
--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "source_format" "routine_source_format" DEFAULT 'native' NOT NULL;
--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "workflow_json" jsonb;
--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "node_id" uuid;
--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "optimized_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN IF NOT EXISTS "optimization_log" jsonb;
--> statement-breakpoint
ALTER TABLE "routine_run" ADD COLUMN IF NOT EXISTS "metadata" jsonb;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine" ADD CONSTRAINT "routine_node_id_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."node"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "routine_node_idx" ON "routine" USING btree ("node_id");

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "routine" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "routine_run" TO mimir_app;
