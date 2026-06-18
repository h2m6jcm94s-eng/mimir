-- Demo lockout gate: time-box demo tenants.

DO $$ BEGIN
  ALTER TABLE "public"."tenant" ADD COLUMN IF NOT EXISTS "demo_expires_at" timestamp with time zone;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "public"."tenant" ADD COLUMN IF NOT EXISTS "is_demo_locked" boolean DEFAULT false NOT NULL;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tenant_demo_expires_at_idx" ON "public"."tenant" USING btree ("demo_expires_at") WHERE "demo_expires_at" IS NOT NULL;
--> statement-breakpoint

GRANT SELECT, UPDATE ON TABLE "public"."tenant" TO mimir_app;
