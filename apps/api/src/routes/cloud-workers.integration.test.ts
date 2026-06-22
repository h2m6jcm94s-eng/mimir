import { RunInstancesCommand } from '@aws-sdk/client-ec2';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { createJob } from '../repositories/job';
import { provisionCloudWorker } from '../services/cloud-worker/provision';
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
    process.env.CLOUD_WORKER_SECURITY_GROUP_IDS = '';
    process.env.CLOUD_WORKER_SUBNET_ID = '';
    process.env.CLOUD_WORKER_IAM_INSTANCE_PROFILE = '';
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
      const user = await resolveAuthUser(token, `${token}@test.local`);
      const { job } = await withTenantTransaction(user.tenantId, async (ctx) => {
        const created = await createJob(ctx, {
          idempotencyKey: `cloud-worker-test-${Date.now()}`,
          type: 'cloud-worker',
          tier: 2,
          input: {},
        });
        return { job: created };
      });

      const app = await buildTestApp(async (app) => {
        await app.register(cloudWorkerRoutes, { prefix: '/v1/cloud-workers' });
        await app.register(cloudWorkerWebhookRoutes, { prefix: '/webhooks' });
      });

      const provisionResponse = await app.inject({
        method: 'POST',
        url: '/v1/cloud-workers',
        headers: { authorization: `Bearer ${token}` },
        payload: { jobId: job.id },
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
      console.log('returnResponse', returnResponse.statusCode, returnResponse.body);

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

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'uses hardened networking when environment variables are set',
    async () => {
      process.env.CLOUD_WORKER_SECURITY_GROUP_IDS = 'sg-123,sg-456';
      process.env.CLOUD_WORKER_SUBNET_ID = 'subnet-789';
      process.env.CLOUD_WORKER_IAM_INSTANCE_PROFILE = 'mimir-cloud-worker-profile';

      const token = `cloud_net_${Date.now()}`;
      const user = await resolveAuthUser(token, `${token}@test.local`);
      const { job } = await withTenantTransaction(user.tenantId, async (ctx) => {
        const created = await createJob(ctx, {
          idempotencyKey: `cloud-worker-net-${Date.now()}`,
          type: 'cloud-worker',
          tier: 2,
          input: {},
        });
        return { job: created };
      });

      const app = await buildTestApp(async (app) => {
        await app.register(cloudWorkerRoutes, { prefix: '/v1/cloud-workers' });
      });

      const provisionResponse = await app.inject({
        method: 'POST',
        url: '/v1/cloud-workers',
        headers: { authorization: `Bearer ${token}` },
        payload: { jobId: job.id },
      });

      expect(provisionResponse.statusCode).toBe(201);
      expect(RunInstancesCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          SecurityGroupIds: ['sg-123', 'sg-456'],
          SubnetId: 'subnet-789',
          IamInstanceProfile: { Name: 'mimir-cloud-worker-profile' },
          MetadataOptions: expect.objectContaining({
            HttpTokens: 'required',
            HttpPutResponseHopLimit: 1,
          }),
        })
      );
    }
  );

  it('rejects provisioning in production without hardened networking', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.CLOUD_WORKER_SECURITY_GROUP_IDS = '';
    process.env.CLOUD_WORKER_SUBNET_ID = '';
    process.env.CLOUD_WORKER_IAM_INSTANCE_PROFILE = '';

    await expect(
      provisionCloudWorker({
        tenantId: '00000000-0000-0000-0000-000000000001',
        jobId: '00000000-0000-0000-0000-000000000002',
        amiId: 'ami-test',
        webhookBaseUrl: 'http://localhost:3001',
      })
    ).rejects.toThrow('CLOUD_WORKER_SECURITY_GROUP_IDS is required in production');

    process.env.NODE_ENV = originalNodeEnv;
  });
});
