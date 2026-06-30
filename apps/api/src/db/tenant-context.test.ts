import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { TenantContext, withTenant, withTenantTransaction } from './tenant-context';

describe('TenantContext', () => {
  it('requires a non-empty tenantId', () => {
    expect(() => new TenantContext('')).toThrow();
  });

  it('withTenant passes a context', async () => {
    const result = await withTenant('tenant-123', async (ctx) => {
      return ctx.tenantId;
    });
    expect(result).toBe('tenant-123');
  });

  it('tenantScopedDb throws outside a transaction (R-16 enforcement)', async () => {
    await withTenant('00000000-0000-0000-0000-000000000001', async (ctx) => {
      expect(() => ctx.tenantScopedDb).toThrow(
        'Tenant-scoped database access outside of a transaction is not allowed'
      );
    });
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'withTenantTransaction sets app.tenant_id for RLS',
    async () => {
      const tenantId = '00000000-0000-0000-0000-000000000001';
      await withTenantTransaction(tenantId, async (ctx) => {
        const [{ setting }] = await ctx.tenantScopedDb.execute<{ setting: string }>(
          sql`SELECT current_setting('app.tenant_id') as setting`
        );
        expect(setting).toBe(tenantId);
      });
    }
  );
});
