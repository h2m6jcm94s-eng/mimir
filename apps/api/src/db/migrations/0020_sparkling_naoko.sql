DO $$ BEGIN
 CREATE TYPE "public"."agent_capability" AS ENUM('chat', 'plan', 'review', 'code', 'search', 'remember', 'act', 'cheap', 'fast', 'creative', 'long_context', 'reasoning');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."agent_role_kind" AS ENUM('main', 'planner', 'reviewer', 'coder', 'researcher', 'memory', 'executor', 'fallback');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "agent_role_kind" NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"tier" integer NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"provider" varchar(32) NOT NULL,
	"model" varchar(255),
	"capabilities" jsonb DEFAULT '[]' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_role" ADD CONSTRAINT "agent_role_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
