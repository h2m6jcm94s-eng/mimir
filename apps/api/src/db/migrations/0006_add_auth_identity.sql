-- Global identity lookup table (NO RLS) used during authentication to resolve
-- a Clerk user id to a tenant/user/role before a tenant transaction context exists.

CREATE TABLE IF NOT EXISTS "auth_identity" (
	"clerk_id" varchar(255) PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_identity" ADD CONSTRAINT "auth_identity_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_identity" ADD CONSTRAINT "auth_identity_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_auth_identity_tenant" ON "auth_identity" USING btree ("tenant_id");
