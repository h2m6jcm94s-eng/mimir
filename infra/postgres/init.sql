-- Initial setup for the Mimir Postgres database.
-- This script runs once when the Postgres container starts with an empty data volume.

CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mimir_app') THEN
    CREATE ROLE mimir_app WITH LOGIN PASSWORD 'mimir_app';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE mimir TO mimir_app;
GRANT ALL PRIVILEGES ON SCHEMA public TO mimir_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mimir_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mimir_app;
