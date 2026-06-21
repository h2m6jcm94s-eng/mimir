CREATE TABLE IF NOT EXISTS "agent_reputation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"role" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_reputation" ADD CONSTRAINT "agent_reputation_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "agent_reputation_tenant_role_idx" ON "agent_reputation" USING btree ("tenant_id", "role");
CREATE INDEX IF NOT EXISTS "agent_reputation_tenant_score_idx" ON "agent_reputation" USING btree ("tenant_id", "score" DESC);

ALTER TABLE "agent_reputation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_reputation" FORCE ROW LEVEL SECURITY;

CREATE POLICY "agent_reputation_tenant_isolation" ON "agent_reputation"
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON TABLE "agent_reputation" TO mimir_app;
