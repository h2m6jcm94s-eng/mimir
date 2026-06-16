import { describe, expect, it } from 'vitest';
import { ApplyRegistry, consoleOutputHandler, defaultHandler } from './registry';

describe('ApplyRegistry', () => {
  const input = { type: 'echo' };
  const draft = { success: true, artifacts: { plan: 'test' }, log: [] };

  it('default handler records idempotently', () => {
    const result = defaultHandler(input, draft, { approved: true });
    expect(result.applied).toBe(true);
    expect(result.reason).toBe('idempotently recorded');
    expect(result.output).toEqual({ plan: 'test' });
  });

  it('console-output handler labels the output', () => {
    const result = consoleOutputHandler(input, draft, { approved: false });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('idempotently recorded (console-output)');
    expect(result.output).toEqual({ type: 'console-output', artifacts: { plan: 'test' } });
  });

  it('falls back to default for unknown types', async () => {
    const registry = new ApplyRegistry();
    const result = await registry.handle('unknown-type', { type: 'unknown-type' }, draft, {
      approved: false,
    });
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('idempotently recorded');
  });

  it('selects handler by input type', async () => {
    const registry = new ApplyRegistry();
    const result = await registry.handle('console-output', { type: 'console-output' }, draft, {
      approved: true,
    });
    expect(result.reason).toBe('idempotently recorded (console-output)');
  });
});
