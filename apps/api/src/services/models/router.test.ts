import { describe, expect, it } from 'vitest';
import { ModelRouter } from './router';

describe('ModelRouter', () => {
  const router = new ModelRouter();

  it('routes T0 to the local adapter', async () => {
    const output = await router.invoke(0, { prompt: 'hello', payload: {} });
    expect(output.tier).toBe(0);
    expect(output.model).toBe('local');
  });

  it('routes T1 to the self-hosted adapter', async () => {
    const output = await router.invoke(1, { prompt: 'hello', payload: {} });
    expect(output.tier).toBe(1);
    expect(output.model).toBe('self-hosted');
  });

  it('routes T2 to the cloud adapter', async () => {
    const output = await router.invoke(2, { prompt: 'hello', payload: {} });
    expect(output.tier).toBe(2);
    expect(output.model).toBe('cloud');
  });

  it('never returns a cloud response for T0 input', async () => {
    for (let i = 0; i < 20; i++) {
      const output = await router.invoke(0, { prompt: `hello ${i}`, payload: {} });
      expect(output.model).not.toBe('cloud');
      expect(output.tier).toBe(0);
    }
  });
});
