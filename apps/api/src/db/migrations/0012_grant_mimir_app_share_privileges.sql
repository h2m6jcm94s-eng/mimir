-- Ensure the application role can read and write the cross-mesh sharing tables.
-- Run as a privileged user (postgres) because mimir_app cannot grant to itself.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "knowledge_share" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "shared_knowledge_item" TO mimir_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "shared_embedding" TO mimir_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO mimir_app;
