-- Expand connector_kind enum for F-019/F-020/F-021 new connectors.
ALTER TYPE "connector_kind" ADD VALUE IF NOT EXISTS 'microsoftGraph';
ALTER TYPE "connector_kind" ADD VALUE IF NOT EXISTS 'discord';
ALTER TYPE "connector_kind" ADD VALUE IF NOT EXISTS 'googleContacts';
ALTER TYPE "connector_kind" ADD VALUE IF NOT EXISTS 'googleDocs';
