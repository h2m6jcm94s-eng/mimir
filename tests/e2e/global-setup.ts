import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import postgres from 'postgres';

const TEST_EXTERNAL_ID = 'test';
const TEST_EMAIL = 'test@test.local';

/**
 * Global setup for Mimir e2e tests.
 *
 * - Assumes Postgres, Redis, Temporal, and Supertokens are already running (see `make up`).
 * - Runs the API's Drizzle migrations so every test starts from a known schema.
 * - Ensures a deterministic test user/tenant exists and wipes any data left over
 *   from previous runs so specs are isolated.
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

  console.log('[e2e setup] Preparing isolated test tenant...');
  const sql = postgres(databaseUrl);

  // Ensure the deterministic test account exists.
  const [account] = await sql`
    INSERT INTO user_account (id, external_id, email)
    VALUES (${randomUUID()}, ${TEST_EXTERNAL_ID}, ${TEST_EMAIL})
    ON CONFLICT (external_id) DO UPDATE SET email = EXCLUDED.email
    RETURNING id;
  `;

  // Look up any tenant left behind from a previous run.
  const [existingIdentity] = await sql`
    SELECT default_tenant_id FROM external_identity WHERE external_id = ${TEST_EXTERNAL_ID};
  `;

  // Drop the old tenant; nearly all tenant-scoped tables cascade on delete,
  // and external_identity has ON DELETE SET NULL for default_tenant_id.
  if (existingIdentity?.defaultTenantId) {
    const staleTenantId = existingIdentity.defaultTenantId as string;
    await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL app.tenant_id = '${staleTenantId}'`);
      await tx`DELETE FROM tenant WHERE id = ${staleTenantId};`;
    });
  }

  // Create a fresh tenant for this run.
  const tenantId = randomUUID();
  await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    await tx`INSERT INTO tenant (id, name, plan) VALUES (${tenantId}, 'Test Tenant', 'free');`;
  });

  // Link the test account as an owner of the new tenant.
  await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
    await tx`
      INSERT INTO app_user (id, tenant_id, user_account_id, role)
      VALUES (${randomUUID()}, ${tenantId}, ${account.id}, 'owner');
    `;
  });

  // Point the test identity at the fresh tenant.
  await sql`
    INSERT INTO external_identity (external_id, user_account_id, default_tenant_id)
    VALUES (${TEST_EXTERNAL_ID}, ${account.id}, ${tenantId})
    ON CONFLICT (external_id) DO UPDATE SET default_tenant_id = EXCLUDED.default_tenant_id;
  `;

  await sql.end();
  console.log('[e2e setup] Isolated test tenant ready:', tenantId);
}
