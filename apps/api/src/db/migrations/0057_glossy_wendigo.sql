ALTER TABLE "session" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_external_id_idx" ON "session" USING btree ("tenant_id","source","external_id");