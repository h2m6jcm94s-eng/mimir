import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudWorkerTokenError, parseReturnToken, signReturnToken } from './token';

vi.unmock('./token');

describe('cloud-worker token', () => {
  const originalSecret = process.env.CLOUD_WORKER_SECRET;

  beforeEach(() => {
    process.env.CLOUD_WORKER_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.CLOUD_WORKER_SECRET = originalSecret;
  });

  it('round-trips a token', () => {
    const token = signReturnToken({
      jobId: '00000000-0000-0000-0000-000000000001',
      tenantId: '00000000-0000-0000-0000-000000000002',
    });
    const parsed = parseReturnToken(token);
    expect(parsed.jobId).toBe('00000000-0000-0000-0000-000000000001');
    expect(parsed.tenantId).toBe('00000000-0000-0000-0000-000000000002');
    expect(parsed.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects a tampered token', () => {
    const token = signReturnToken({
      jobId: '00000000-0000-0000-0000-000000000001',
      tenantId: '00000000-0000-0000-0000-000000000002',
    });
    const tampered = `${token.slice(0, -4)}ffff`;
    expect(() => parseReturnToken(tampered)).toThrow(CloudWorkerTokenError);
  });

  it('rejects an expired token', () => {
    const token = signReturnToken(
      {
        jobId: '00000000-0000-0000-0000-000000000001',
        tenantId: '00000000-0000-0000-0000-000000000002',
      },
      -1
    );
    expect(() => parseReturnToken(token)).toThrow('Token expired');
  });
});
