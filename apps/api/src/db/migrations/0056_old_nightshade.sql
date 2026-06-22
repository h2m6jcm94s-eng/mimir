ALTER TABLE "mesh_meta" ADD COLUMN "transition_state" text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
ALTER TABLE "mesh_meta" ADD COLUMN "lease_token" uuid;
--> statement-breakpoint
ALTER TABLE "mesh_meta" ADD COLUMN "lease_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "mesh_meta" DROP CONSTRAINT IF EXISTS "mesh_meta_transition_state_check";
--> statement-breakpoint
ALTER TABLE "mesh_meta" ADD CONSTRAINT "mesh_meta_transition_state_check" CHECK ("transition_state" IN ('active', 'promoting', 'read_only'));
--> statement-breakpoint
ALTER TABLE "mesh_meta" DROP CONSTRAINT IF EXISTS "mesh_meta_epoch_floor_check";
--> statement-breakpoint
ALTER TABLE "mesh_meta" ADD CONSTRAINT "mesh_meta_epoch_floor_check" CHECK ("epoch" >= "min_epoch");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mesh_meta_tenant_epoch_idx" ON "mesh_meta" USING btree ("tenant_id","epoch");
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "mesh_meta" TO mimir_app';
  EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mimir_app';
EXCEPTION
  WHEN insufficient_privilege THEN null;
END
$$;
