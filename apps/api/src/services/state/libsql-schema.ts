import { getLibSqlClient } from '../../db/libsql';

export const LIBSQL_SCHEMA = `
CREATE TABLE IF NOT EXISTS job (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  workflow_id TEXT,
  run_id TEXT,
  idempotency_key TEXT NOT NULL,
  type TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  input TEXT,
  result TEXT,
  epoch INTEGER NOT NULL DEFAULT 0,
  checkpoint TEXT NOT NULL DEFAULT '{}',
  cost_usd INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  started_at TEXT,
  finished_at TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_tenant_status ON job (tenant_id, status);

CREATE TABLE IF NOT EXISTS node (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  owner_user_account_id TEXT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  tier INTEGER NOT NULL,
  tailnet_addr TEXT,
  public_key TEXT,
  api_key_hash TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_seen TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_node_tenant ON node (tenant_id);
`;

export async function initializeLibSqlSchema(): Promise<void> {
  const client = getLibSqlClient();
  await client.executeMultiple(LIBSQL_SCHEMA);
}
