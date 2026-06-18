-- Notification delivery service (F-025).
CREATE TYPE "notification_channel" AS ENUM ('in_app', 'email', 'slack', 'webhook');
CREATE TYPE "notification_status" AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE "notification_priority" AS ENUM ('low', 'normal', 'high');

CREATE TABLE "notification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "priority" "notification_priority" NOT NULL DEFAULT 'normal',
  "dedup_key" text,
  "payload" jsonb,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "notification_dedup_idx" ON "notification" ("tenant_id", "dedup_key");

CREATE TABLE "notification_delivery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenant"("id") ON DELETE CASCADE,
  "notification_id" uuid NOT NULL REFERENCES "notification"("id") ON DELETE CASCADE,
  "channel" "notification_channel" NOT NULL,
  "status" "notification_status" NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "external_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification" FORCE ROW LEVEL SECURITY;
ALTER TABLE "notification_delivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_delivery" FORCE ROW LEVEL SECURITY;

CREATE POLICY "notification_tenant_isolation" ON "notification"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

CREATE POLICY "notification_delivery_tenant_isolation" ON "notification_delivery"
  USING ("tenant_id" = current_setting('app.tenant_id')::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notification" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notification_delivery" TO mimir_app;
