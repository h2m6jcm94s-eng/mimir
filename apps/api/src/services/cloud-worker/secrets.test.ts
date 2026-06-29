import { beforeEach, describe, expect, it, vi } from 'vitest';
import { secrets } from '../../config/secrets';

vi.mock('../../config/secrets', () => ({
  secrets: { get: vi.fn() },
}));

const getSecret = vi.mocked(secrets.get);

describe('resolveCloudWorkerSecret', () => {
  beforeEach(() => {
    getSecret.mockReset();
    vi.unstubAllEnvs();
  });

  it('prefers the cloud-worker-secret vault alias over env', async () => {
    getSecret.mockImplementation(async (key: string) =>
      key === 'cloud-worker-secret' ? 'vault-cloud-secret' : undefined
    );
    vi.stubEnv('CLOUD_WORKER_SECRET', 'env-cloud-secret');

    const { resolveCloudWorkerSecret, signReturnToken, parseReturnToken } = await import(
      './token.js'
    );
    await resolveCloudWorkerSecret();

    const token = signReturnToken({
      jobId: '00000000-0000-0000-0000-000000000001',
      tenantId: '00000000-0000-0000-0000-000000000002',
    });
    const parsed = parseReturnToken(token);
    expect(parsed.jobId).toBe('00000000-0000-0000-0000-000000000001');
  });
});
