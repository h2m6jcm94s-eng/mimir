import { describe, expect, it } from 'vitest';
import { TenantContext } from '../../db/tenant-context';
import { ApplyRegistry, consoleOutputHandler, defaultHandler } from './registry';

function fakeCtx(): TenantContext {
  return new TenantContext('00000000-0000-0000-0000-000000000000');
}

describe('ApplyRegistry', () => {
  const input = {
    tenantId: '00000000-0000-0000-0000-000000000000',
    userId: 'user',
    jobId: 'job',
    idempotencyKey: 'key',
    type: 'echo',
    tier: 1,
    payload: {},
  };
  const draft = { success: true, artifacts: { plan: 'test' }, log: [] };

  it('default handler records idempotently', () => {
    const result = defaultHandler(fakeCtx(), input, draft, { approved: true });
    expect(result.applied).toBe(true);
    expect(result.reason).toBe('idempotently recorded');
    expect(result.output).toEqual({ plan: 'test' });
  });

  it('console-output handler labels the output', () => {
    const result = consoleOutputHandler(fakeCtx(), input, draft, { approved: false });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('idempotently recorded (console-output)');
    expect(result.output).toEqual({ type: 'console-output', artifacts: { plan: 'test' } });
  });

  it('falls back to default for unknown types', async () => {
    const registry = new ApplyRegistry();
    const result = await registry.handle(fakeCtx(), 'unknown-type', input, draft, {
      approved: false,
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('idempotently recorded');
  });

  it('selects handler by input type', async () => {
    const registry = new ApplyRegistry();
    const result = await registry.handle(fakeCtx(), 'console-output', input, draft, {
      approved: true,
    });
    expect(result.reason).toBe('idempotently recorded (console-output)');
  });
});
