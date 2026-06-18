-- Marketing / creator assistant (F-059) Phase 1.

DO $$ BEGIN
  CREATE TYPE "public"."marketing_campaign_status" AS ENUM('draft', 'active', 'completed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."marketing_calendar_status" AS ENUM('draft', 'scheduled', 'published');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."marketing_platform" AS ENUM('blog', 'twitter', 'linkedin', 'instagram', 'facebook', 'email', 'ad');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "brand_voice" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "tone" text NOT NULL DEFAULT '',
  "audience" text NOT NULL DEFAULT '',
  "guidelines" text NOT NULL DEFAULT '',
  "sample_text" text NOT NULL DEFAULT '',
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "campaign" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "brand_voice_id" uuid,
  "name" text NOT NULL,
  "goal" text NOT NULL DEFAULT '',
  "status" "marketing_campaign_status" NOT NULL DEFAULT 'draft',
  "start_date" timestamp with time zone,
  "end_date" timestamp with time zone,
  "budget" integer,
  "metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "content_calendar_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "campaign_id" uuid,
  "title" text NOT NULL,
  "body" text NOT NULL DEFAULT '',
  "platform" "marketing_platform" NOT NULL,
  "scheduled_at" timestamp with time zone,
  "status" "marketing_calendar_status" NOT NULL DEFAULT 'draft',
  "tier" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "brand_voice" ADD CONSTRAINT "brand_voice_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "campaign" ADD CONSTRAINT "campaign_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "campaign" ADD CONSTRAINT "campaign_brand_voice_id_brand_voice_id_fk" FOREIGN KEY ("brand_voice_id") REFERENCES "public"."brand_voice"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "content_calendar_item" ADD CONSTRAINT "content_calendar_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "content_calendar_item" ADD CONSTRAINT "content_calendar_item_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "brand_voice_tenant_idx" ON "brand_voice" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_tenant_status_idx" ON "campaign" USING btree ("tenant_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_calendar_item_tenant_status_idx" ON "content_calendar_item" USING btree ("tenant_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_calendar_item_scheduled_idx" ON "content_calendar_item" USING btree ("tenant_id", "scheduled_at");
--> statement-breakpoint

ALTER TABLE "brand_voice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brand_voice" FORCE ROW LEVEL SECURITY;
ALTER TABLE "campaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaign" FORCE ROW LEVEL SECURITY;
ALTER TABLE "content_calendar_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_calendar_item" FORCE ROW LEVEL SECURITY;

CREATE POLICY "brand_voice_tenant_isolation" ON "brand_voice"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

CREATE POLICY "campaign_tenant_isolation" ON "campaign"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

CREATE POLICY "content_calendar_item_tenant_isolation" ON "content_calendar_item"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "brand_voice" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "campaign" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "content_calendar_item" TO mimir_app;
