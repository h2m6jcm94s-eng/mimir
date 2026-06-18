-- Ensure the application role can read and write the job_event table.
-- Run as a privileged user (postgres) because mimir_app cannot grant to itself.

GRANT SELECT, INSERT ON TABLE "job_event" TO mimir_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mimir_app;
