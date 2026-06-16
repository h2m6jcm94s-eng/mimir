import { describe, expect, it } from 'vitest';
import { TenantContext, withTenant } from './tenant-context';

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
});
