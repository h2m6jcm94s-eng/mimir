-- Ensure the application role can read and write the governance tables.
-- Run as a privileged user (postgres) because mimir_app cannot grant to itself.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "policy" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "approval" TO mimir_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mimir_app;
