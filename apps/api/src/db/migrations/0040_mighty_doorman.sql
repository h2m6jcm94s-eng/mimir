DO $$ BEGIN
 CREATE TYPE "public"."approval_risk" AS ENUM('low', 'medium', 'high');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "approval" ADD COLUMN IF NOT EXISTS "risk" "approval_risk" DEFAULT 'low' NOT NULL;--> statement-breakpoint
ALTER TABLE "approval" ADD COLUMN IF NOT EXISTS "blast_radius" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "approval" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_account" ADD COLUMN IF NOT EXISTS "pin_hash" varchar(255);
