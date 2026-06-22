CREATE TABLE IF NOT EXISTS "chat_channel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_by_user_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"sender_user_account_id" uuid NOT NULL,
	"encrypted_payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"user_account_id" uuid NOT NULL,
	"encrypted_channel_key" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_channel" ADD CONSTRAINT "chat_channel_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_channel" ADD CONSTRAINT "chat_channel_created_by_user_account_id_user_account_id_fk" FOREIGN KEY ("created_by_user_account_id") REFERENCES "public"."user_account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_sender_user_account_id_user_account_id_fk" FOREIGN KEY ("sender_user_account_id") REFERENCES "public"."user_account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_participant" ADD CONSTRAINT "chat_participant_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_participant" ADD CONSTRAINT "chat_participant_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat_participant" ADD CONSTRAINT "chat_participant_user_account_id_user_account_id_fk" FOREIGN KEY ("user_account_id") REFERENCES "public"."user_account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_channel_tenant_idx" ON "chat_channel" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_message_channel_created_idx" ON "chat_message" USING btree ("channel_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_participant_channel_idx" ON "chat_participant" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_participant_user_idx" ON "chat_participant" USING btree ("tenant_id","user_account_id");
--> statement-breakpoint
ALTER TABLE "chat_channel" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "chat_participant" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "chat_message" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "chat_channel_tenant_isolation" ON "chat_channel";
--> statement-breakpoint
CREATE POLICY "chat_channel_tenant_isolation" ON "chat_channel"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
DROP POLICY IF EXISTS "chat_participant_tenant_isolation" ON "chat_participant";
--> statement-breakpoint
CREATE POLICY "chat_participant_tenant_isolation" ON "chat_participant"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
DROP POLICY IF EXISTS "chat_message_tenant_isolation" ON "chat_message";
--> statement-breakpoint
CREATE POLICY "chat_message_tenant_isolation" ON "chat_message"
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "chat_channel" TO mimir_app';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "chat_participant" TO mimir_app';
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "chat_message" TO mimir_app';
  EXECUTE 'GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mimir_app';
EXCEPTION
  WHEN insufficient_privilege THEN null;
END
$$;
