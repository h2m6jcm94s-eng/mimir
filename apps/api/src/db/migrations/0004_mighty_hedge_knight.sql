CREATE TABLE IF NOT EXISTS "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"prev_hash" varchar(128),
	"hash" varchar(128) NOT NULL,
	"actor" varchar(255) NOT NULL,
	"action" varchar(255) NOT NULL,
	"tier" integer DEFAULT 0 NOT NULL,
	"payload_hash" varchar(128) NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
