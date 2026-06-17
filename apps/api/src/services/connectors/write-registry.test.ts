import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { TenantContext } from '../../db/tenant-context';
import * as connectorRepository from '../../repositories/connector';
import { type ConnectorWriteDescriptor, connectorWriteRegistry } from './write-registry';

const TestInput = z.object({ message: z.string().min(1) });

describe('ConnectorWriteRegistry', () => {
  it('registers a descriptor and produces an apply handler', async () => {
    const apply = vi.fn().mockResolvedValue({ applied: true, reason: 'ok', output: { id: 1 } });

    const descriptor: ConnectorWriteDescriptor = {
      kind: 'telegram',
      action: 'sendMessage',
      inputSchema: TestInput as unknown as import('zod').ZodType<unknown>,
      preview: (input) => (input as { message: string }).message,
      approvalMessage: (input) => ({
        title: 'Send message',
        description: `Send "${(input as { message: string }).message}"`,
      }),
      apply,
    };

    connectorWriteRegistry.register(descriptor);

    expect(connectorWriteRegistry.has('telegram', 'sendMessage')).toBe(true);
    expect(connectorWriteRegistry.get('telegram', 'sendMessage')?.kind).toBe('telegram');

    vi.spyOn(connectorRepository, 'findConnectorByKind').mockResolvedValue({
      id: 'conn-1',
      tenantId: 'tenant-1',
      kind: 'telegram',
      account: null,
      secretRef: 'telegram',
      scopes: [],
      tier: 1,
      status: 'connected',
      lastSync: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Awaited<ReturnType<typeof connectorRepository.findConnectorByKind>>);

    const handler = connectorWriteRegistry.applyHandlerFor(descriptor);
    const result = await handler(
      {} as TenantContext,
      {
        tenantId: 'tenant-1',
        userId: 'user-1',
        jobId: 'job-1',
        idempotencyKey: 'key-1',
        type: 'telegram.sendMessage',
        tier: 1,
        payload: { message: 'hello' },
      },
      { success: true, artifacts: {}, log: [] },
      { approved: true }
    );

    expect(result.applied).toBe(true);
    expect(apply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: 'tenant-1', kind: 'telegram', secretRef: 'telegram' }),
      { message: 'hello' },
      expect.objectContaining({ secrets: expect.anything() })
    );
  });

  it('returns not applied when review is denied', async () => {
    const descriptor: ConnectorWriteDescriptor = {
      kind: 'telegram',
      action: 'sendMessage',
      inputSchema: TestInput as unknown as import('zod').ZodType<unknown>,
      preview: () => '',
      approvalMessage: () => ({ title: '', description: '' }),
      apply: vi.fn(),
    };

    const handler = connectorWriteRegistry.applyHandlerFor(descriptor);
    const result = await handler(
      {} as TenantContext,
      {
        tenantId: 'tenant-1',
        userId: 'user-1',
        jobId: 'job-1',
        idempotencyKey: 'key-1',
        type: 'telegram.sendMessage',
        tier: 1,
        payload: { message: 'hello' },
      },
      { success: true, artifacts: {}, log: [] },
      { approved: false }
    );

    expect(result.applied).toBe(false);
    expect(result.reason).toContain('Review did not approve');
  });

  it('returns not applied when payload is invalid', async () => {
    const descriptor: ConnectorWriteDescriptor = {
      kind: 'telegram',
      action: 'sendMessage',
      inputSchema: TestInput as unknown as import('zod').ZodType<unknown>,
      preview: () => '',
      approvalMessage: () => ({ title: '', description: '' }),
      apply: vi.fn(),
    };

    vi.spyOn(connectorRepository, 'findConnectorByKind').mockResolvedValue({
      tier: 1,
    } as Awaited<ReturnType<typeof connectorRepository.findConnectorByKind>>);

    const handler = connectorWriteRegistry.applyHandlerFor(descriptor);
    const result = await handler(
      {} as TenantContext,
      {
        tenantId: 'tenant-1',
        userId: 'user-1',
        jobId: 'job-1',
        idempotencyKey: 'key-1',
        type: 'telegram.sendMessage',
        tier: 1,
        payload: { message: '' },
      },
      { success: true, artifacts: {}, log: [] },
      { approved: true }
    );

    expect(result.applied).toBe(false);
    expect(result.reason).toContain('Invalid payload');
  });
});
