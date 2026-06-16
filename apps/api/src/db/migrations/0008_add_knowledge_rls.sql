-- Knowledge base schema and tenant isolation.
-- Depends on the pgvector extension (0007_enable_pgvector.sql).

DO $$ BEGIN
 CREATE TYPE "public"."knowledge_kind" AS ENUM('doc', 'code', 'screenshot', 'web');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
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
CREATE TABLE IF NOT EXISTS "embedding" (
	"id" bigint generated always as identity primary key,
	"tenant_id" uuid NOT NULL,
	"knowledge_item_id" uuid NOT NULL,
	"chunk_idx" integer NOT NULL,
	"text" text NOT NULL,
	"vector" vector(768) NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_item" ADD CONSTRAINT "knowledge_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
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
ALTER TABLE "knowledge_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_item" FORCE ROW LEVEL SECURITY;
ALTER TABLE "embedding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "embedding" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "knowledge_item_isolation" ON "knowledge_item";
CREATE POLICY "knowledge_item_isolation" ON "knowledge_item"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS "embedding_isolation" ON "embedding";
CREATE POLICY "embedding_isolation" ON "embedding"
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX IF NOT EXISTS "idx_knowledge_item_tenant" ON "knowledge_item" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_embedding_item" ON "embedding" USING btree ("knowledge_item_id");
CREATE INDEX IF NOT EXISTS "idx_embedding_tenant" ON "embedding" USING btree ("tenant_id");
