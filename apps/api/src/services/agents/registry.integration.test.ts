import { AgentRoleInput } from '@mimir/shared-types';
import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../../db/tenant-context';
import { resolveAuthUser } from '../../middleware/auth';
import { AgentRoleRegistry } from './registry';

describe('AgentRoleRegistry', () => {
  it.skipIf(!process.env.RUN_DB_TESTS)('seeds built-in defaults for an empty tenant', async () => {
    const externalId = `agent_role_user_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
    const registry = new AgentRoleRegistry();

    const roles = await withTenantTransaction(user.tenantId, async (ctx) => {
      await registry.seedDefaults(ctx);
      return registry.list(ctx);
    });

    expect(roles.length).toBeGreaterThan(0);
    const mainT0 = roles.find((r) => r.kind === 'main' && r.tier === 0);
    expect(mainT0?.provider).toBe('local');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'resolves a role to a provider/model without hard-coding a vendor',
    async () => {
      const externalId = `agent_role_user_${Date.now()}`;
      const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
      const registry = new AgentRoleRegistry();

      const result = await withTenantTransaction(user.tenantId, async (ctx) => {
        await registry.seedDefaults(ctx);
        return registry.resolve(ctx, { kind: 'reviewer', tier: 1 });
      });

      expect(result.kind).toBe('reviewer');
      expect(result.tier).toBe(1);
      expect(result.provider).toBeDefined();
      expect(result.capabilities).toContain('review');
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'prefers a tenant-specific custom role over built-in defaults',
    async () => {
      const externalId = `agent_role_user_${Date.now()}`;
      const user = await resolveAuthUser(externalId, `${externalId}@test.local`);
      const registry = new AgentRoleRegistry();

      const custom = await withTenantTransaction(user.tenantId, async (ctx) => {
        await registry.seedDefaults(ctx);
        return registry.create(
          ctx,
          AgentRoleInput.parse({
            kind: 'main',
            name: 'Custom main',
            tier: 1,
            provider: 'groq',
            model: 'llama3-70b',
            priority: 10,
            capabilities: ['chat', 'fast'],
            isDefault: true,
          })
        );
      });

      const result = await withTenantTransaction(user.tenantId, async (ctx) =>
        registry.resolve(ctx, { kind: 'main', tier: 1 })
      );

      expect(result.roleId).toBe(custom.id);
      expect(result.provider).toBe('groq');
      expect(result.model).toBe('llama3-70b');
    }
  );
});
