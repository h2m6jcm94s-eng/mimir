-- Add missing updated_at column to job table to match the Drizzle schema.
ALTER TABLE "job" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
