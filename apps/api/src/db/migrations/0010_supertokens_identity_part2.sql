ALTER TABLE "app_user" ALTER COLUMN "user_account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user" DROP COLUMN IF EXISTS "clerk_id";--> statement-breakpoint
DROP TABLE IF EXISTS "auth_identity";