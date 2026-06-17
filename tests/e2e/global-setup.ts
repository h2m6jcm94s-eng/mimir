import { execSync } from 'node:child_process';
import path from 'node:path';
import postgres from 'postgres';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Global setup for Mimir e2e tests.
 *
 * - Assumes Postgres, Redis, Temporal, and Supertokens are already running (see `make up`).
 * - Runs the API's Drizzle migrations so every test starts from a known schema.
 * - Ensures the test tenant exists so authenticated API calls can write rows.
 */
export default async function globalSetup() {
  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://mimir_app:mimir_app@localhost:5432/mimir';

  console.log('[e2e setup] Running database migrations...');
  execSync('pnpm --filter @mimir/api db:migrate', {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
  console.log('[e2e setup] Migrations complete.');

  console.log('[e2e setup] Ensuring test tenant exists...');
  const sql = postgres(databaseUrl);
  await sql`
    SET LOCAL app.tenant_id = ${TEST_TENANT_ID};
    INSERT INTO tenant (id, name, plan)
    VALUES (${TEST_TENANT_ID}, 'Test Tenant', 'free')
    ON CONFLICT (id) DO NOTHING;
  `;
  await sql.end();
  console.log('[e2e setup] Test tenant ready.');
}
