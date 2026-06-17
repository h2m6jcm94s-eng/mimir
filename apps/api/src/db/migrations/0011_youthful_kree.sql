DO $$ BEGIN
 CREATE TYPE "public"."knowledge_share_scope" AS ENUM('search', 'read');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."knowledge_share_status" AS ENUM('pending', 'approved', 'denied', 'revoked', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_share" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_tenant_id" uuid NOT NULL,
	"requester_tenant_id" uuid NOT NULL,
	"knowledge_item_id" uuid NOT NULL,
	"status" "knowledge_share_status" DEFAULT 'pending' NOT NULL,
	"scope" "knowledge_share_scope" DEFAULT 'search' NOT NULL,
	"tier" integer DEFAULT 0 NOT NULL,
	"requested_by_user_account_id" uuid NOT NULL,
	"reviewed_by_user_account_id" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shared_embedding" (
	"id" bigint generated always as identity primary key,
	"tenant_id" uuid NOT NULL,
	"shared_knowledge_item_id" uuid NOT NULL,
	"chunk_idx" integer NOT NULL,
	"text" text NOT NULL,
	"vector" vector(768) NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shared_knowledge_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"share_id" uuid NOT NULL,
	"source_tenant_id" uuid NOT NULL,
	"source_knowledge_item_id" uuid NOT NULL,
	"kind" "knowledge_kind" NOT NULL,
	"uri" text,
	"tier" integer DEFAULT 0 NOT NULL,
	"hash" text NOT NULL,
	"content" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_share" ADD CONSTRAINT "knowledge_share_provider_tenant_id_tenant_id_fk" FOREIGN KEY ("provider_tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_share" ADD CONSTRAINT "knowledge_share_requester_tenant_id_tenant_id_fk" FOREIGN KEY ("requester_tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_share" ADD CONSTRAINT "knowledge_share_knowledge_item_id_knowledge_item_id_fk" FOREIGN KEY ("knowledge_item_id") REFERENCES "public"."knowledge_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_share" ADD CONSTRAINT "knowledge_share_requested_by_user_account_id_user_account_id_fk" FOREIGN KEY ("requested_by_user_account_id") REFERENCES "public"."user_account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_share" ADD CONSTRAINT "knowledge_share_reviewed_by_user_account_id_user_account_id_fk" FOREIGN KEY ("reviewed_by_user_account_id") REFERENCES "public"."user_account"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_embedding" ADD CONSTRAINT "shared_embedding_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_embedding" ADD CONSTRAINT "shared_embedding_shared_knowledge_item_id_shared_knowledge_item_id_fk" FOREIGN KEY ("shared_knowledge_item_id") REFERENCES "public"."shared_knowledge_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_knowledge_item" ADD CONSTRAINT "shared_knowledge_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_knowledge_item" ADD CONSTRAINT "shared_knowledge_item_share_id_knowledge_share_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."knowledge_share"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_share_provider_idx" ON "knowledge_share" ("provider_tenant_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_share_requester_idx" ON "knowledge_share" ("requester_tenant_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_knowledge_item_tenant_idx" ON "shared_knowledge_item" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_embedding_tenant_idx" ON "shared_embedding" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_embedding_item_idx" ON "shared_embedding" ("shared_knowledge_item_id");
--> statement-breakpoint
ALTER TABLE "knowledge_share" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shared_knowledge_item" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shared_embedding" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "knowledge_share" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shared_knowledge_item" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shared_embedding" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "knowledge_share_isolation" ON "knowledge_share";
--> statement-breakpoint
CREATE POLICY "knowledge_share_isolation" ON "knowledge_share"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (
    "provider_tenant_id" = current_setting('app.tenant_id', true)::uuid
    OR "requester_tenant_id" = current_setting('app.tenant_id', true)::uuid
  )
  WITH CHECK (
    "provider_tenant_id" = current_setting('app.tenant_id', true)::uuid
    OR "requester_tenant_id" = current_setting('app.tenant_id', true)::uuid
  );
--> statement-breakpoint
DROP POLICY IF EXISTS "shared_knowledge_item_isolation" ON "shared_knowledge_item";
--> statement-breakpoint
CREATE POLICY "shared_knowledge_item_isolation" ON "shared_knowledge_item"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
DROP POLICY IF EXISTS "shared_embedding_isolation" ON "shared_embedding";
--> statement-breakpoint
CREATE POLICY "shared_embedding_isolation" ON "shared_embedding"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid);
