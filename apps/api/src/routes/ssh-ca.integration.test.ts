import { execSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import rateLimit from 'fastify-rate-limit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthUser } from '../middleware/auth';
import { authMiddleware, registerAuth, setExternalIdResolver } from '../middleware/auth';
import { sshCaRoutes } from './ssh-ca';

const testUser: AuthUser = {
  userId: 'user-1',
  userAccountId: 'user-account-1',
  tenantId: 'tenant-1',
  role: 'owner',
  externalId: 'supertokens_test',
  email: 'supertokens_test@test.local',
};

describe('ssh ca routes', () => {
  const app = Fastify({ logger: false });
  let tmpDir: string;
  const originalUserPrivateKey = process.env.SSH_CA_USER_PRIVATE_KEY_FILE;
  const originalHostPrivateKey = process.env.SSH_CA_HOST_PRIVATE_KEY_FILE;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    tmpDir = await mkdtemp(join(tmpdir(), 'mimir-ssh-ca-route-'));

    for (const type of ['user', 'host'] as const) {
      const keyPath = join(tmpDir, `ca-${type}`);
      execSync(`ssh-keygen -t ed25519 -f ${keyPath} -N '' -C mimir-${type}-ca`, {
        stdio: 'ignore',
      });
    }

    process.env.SSH_CA_USER_PRIVATE_KEY_FILE = join(tmpDir, 'ca-user');
    process.env.SSH_CA_HOST_PRIVATE_KEY_FILE = join(tmpDir, 'ca-host');

    await registerAuth(app);
    setExternalIdResolver(async () => testUser);
    await app.register(rateLimit, { max: 10_000, timeWindow: '1 minute' });
    app.addHook('preHandler', async (request, reply) => {
      if (request.url.startsWith('/v1/')) {
        await authMiddleware(request, reply);
      }
    });
    await app.register(sshCaRoutes, { prefix: '/v1' });
  });

  afterAll(() => {
    process.env.SSH_CA_USER_PRIVATE_KEY_FILE = originalUserPrivateKey;
    process.env.SSH_CA_HOST_PRIVATE_KEY_FILE = originalHostPrivateKey;
  });

  it('signs a user certificate', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/nodes/node-1/ssh-cert',
      headers: { Authorization: 'Bearer test' },
      payload: {
        publicKey:
          'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDIhz2GK/XCUj4i6Q5yQJNL1MXMY0RxzPV2QrBqfHrDq test',
        keyId: 'test-user',
        type: 'user',
        principals: ['alice'],
        validForSeconds: 3600,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.certificate).toContain('ssh-ed25519-cert-v01@openssh.com');
    expect(body.data.nodeId).toBe('node-1');
    expect(new Date(body.data.validUntil).getTime()).toBeGreaterThan(
      new Date(body.data.validFrom).getTime()
    );
  });

  it('signs a host certificate', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/nodes/node-2/ssh-cert',
      headers: { Authorization: 'Bearer test' },
      payload: {
        publicKey:
          'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDIhz2GK/XCUj4i6Q5yQJNL1MXMY0RxzPV2QrBqfHrDq host',
        keyId: 'test-host',
        type: 'host',
        principals: ['node-2.local'],
        validForSeconds: 3600,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.certificate).toContain('ssh-ed25519-cert-v01@openssh.com');
  });

  it('returns 401 without authorization', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/nodes/node-1/ssh-cert',
      payload: {
        publicKey:
          'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDIhz2GK/XCUj4i6Q5yQJNL1MXMY0RxzPV2QrBqfHrDq test',
        keyId: 'test-user',
        type: 'user',
        principals: ['alice'],
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
