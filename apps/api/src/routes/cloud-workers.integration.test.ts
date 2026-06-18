import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { cloudWorkerRoutes, cloudWorkerWebhookRoutes } from './cloud-workers';

vi.mock('@aws-sdk/client-ec2', () => ({
  EC2Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({
      Instances: [
        {
          InstanceId: 'i-1234567890abcdef0',
          PrivateIpAddress: '10.0.0.5',
        },
      ],
    }),
  })),
  RunInstancesCommand: vi.fn().mockImplementation((input) => input),
}));

describe('cloud worker routes', () => {
  const originalSecret = process.env.CLOUD_WORKER_SECRET;

  beforeEach(() => {
    process.env.CLOUD_WORKER_SECRET = 'test-secret';
    process.env.CLOUD_WORKER_WEBHOOK_BASE_URL = 'http://localhost:3001';
    process.env.TAILSCALE_AUTH_KEY = 'tskey-test';
    process.env.CLOUD_WORKER_AMI_ID = 'ami-test';
  });

  afterEach(() => {
    process.env.CLOUD_WORKER_SECRET = originalSecret;
  });

  it('returns 401 without authorization', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(cloudWorkerRoutes, { prefix: '/v1/cloud-workers' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/cloud-workers',
      payload: { jobId: '00000000-0000-0000-0000-000000000001' },
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'provisions a cloud worker and accepts the return webhook',
    async () => {
      const token = `cloud_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(cloudWorkerRoutes, { prefix: '/v1/cloud-workers' });
        await app.register(cloudWorkerWebhookRoutes, { prefix: '/webhooks' });
      });

      const provisionResponse = await app.inject({
        method: 'POST',
        url: '/v1/cloud-workers',
        headers: { authorization: `Bearer ${token}` },
        payload: { jobId: '00000000-0000-0000-0000-000000000001' },
      });

      expect(provisionResponse.statusCode).toBe(201);
      const provisioned = JSON.parse(provisionResponse.body);
      expect(provisioned.instanceId).toBe('i-1234567890abcdef0');
      expect(provisioned.returnUrl).toContain('/webhooks/cloud-workers/return/');

      const returnToken = provisioned.returnUrl.split('/').pop();
      const returnResponse = await app.inject({
        method: 'POST',
        url: `/webhooks/cloud-workers/return/${returnToken}`,
        payload: { exitCode: 0, result: { ok: true } },
      });

      expect(returnResponse.statusCode).toBe(200);
      expect(JSON.parse(returnResponse.body).ok).toBe(true);

      // Second use of the same token must be rejected.
      const replayResponse = await app.inject({
        method: 'POST',
        url: `/webhooks/cloud-workers/return/${returnToken}`,
        payload: { exitCode: 0 },
      });
      expect(replayResponse.statusCode).toBe(401);
    }
  );
});
