DO $$ BEGIN
 CREATE TYPE "public"."knowledge_kind" AS ENUM('doc', 'code', 'screenshot', 'web');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "user_role" ADD VALUE 'manager';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "external_identity" (
	"external_id" varchar(255) NOT NULL,
	"user_account_id" uuid NOT NULL,
	"default_tenant_id" uuid,
	CONSTRAINT "external_identity_external_id_pk" PRIMARY KEY("external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_account_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "user_account_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"owner_user_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "embedding" (
	"id" "bigint generated always as identity primary key",
	"tenant_id" uuid NOT NULL,
	"knowledge_item_id" uuid NOT NULL,
	"chunk_idx" integer NOT NULL,
	"text" text NOT NULL,
	"vector" vector(768) NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "knowledge_kind" NOT NULL,
	"uri" text,
	"tier" integer DEFAULT 0 NOT NULL,
	"hash" text NOT NULL,
	"content" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_user" DROP CONSTRAINT "app_user_clerk_id_unique";--> statement-breakpoint
ALTER TABLE "app_user" ALTER COLUMN "clerk_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "user_account_id" uuid;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "node" ADD COLUMN "owner_user_account_id" uuid;--> statement-breakpoint
ALTER TABLE "node" ADD COLUMN "public_key" text;--> statement-breakpoint
ALTER TABLE "node" ADD COLUMN "api_key_hash" varchar(255);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_identity" ADD CONSTRAINT "external_identity_user_account_id_user_account_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "external_identity" ADD CONSTRAINT "external_identity_default_tenant_id_tenant_id_fk" FOREIGN KEY ("default_tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organization" ADD CONSTRAINT "organization_owner_user_account_id_user_account_id_fk" FOREIGN KEY ("owner_user_account_id") REFERENCES "public"."user_account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "embedding" ADD CONSTRAINT "embedding_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "embedding" ADD CONSTRAINT "embedding_knowledge_item_id_knowledge_item_id_fk" FOREIGN KEY ("knowledge_item_id") REFERENCES "public"."knowledge_item"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_item" ADD CONSTRAINT "knowledge_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app_user" ADD CONSTRAINT "app_user_user_account_id_user_account_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenant" ADD CONSTRAINT "tenant_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "node" ADD CONSTRAINT "node_owner_user_account_id_user_account_id_fk" FOREIGN KEY ("owner_user_account_id") REFERENCES "public"."user_account"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
