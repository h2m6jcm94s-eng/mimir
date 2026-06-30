import { createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { createConnector } from '../repositories/connector';
import { findSessionByExternalId, getSessionMessages } from '../repositories/session';
import { startTaskWorkflow } from '../temporal/client';
import { buildTestApp } from '../test-helpers/build-app';
import { discordWebhookRoutes } from './discord-webhook';

const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const publicKeyHex = Buffer.from(createPublicKey(publicKey).export({ type: 'spki', format: 'der' }))
  .subarray(-32)
  .toString('hex');

function signDiscordBody(body: string, timestamp: string): string {
  const message = Buffer.from(timestamp + body);
  return sign(null, message, privateKey).toString('hex');
}

vi.mock('../db/redis', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('../temporal/client', () => ({
  startTaskWorkflow: vi.fn().mockResolvedValue({ workflowId: 'wf-1', runId: 'run-1' }),
}));

describe('discord webhook routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('returns 401 without valid signature', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(discordWebhookRoutes, { prefix: '/webhooks' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/discord/00000000-0000-0000-0000-000000000000',
      payload: { type: 1 },
    });

    expect(response.statusCode).toBe(401);
  });

  it('responds to Discord ping challenge', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(discordWebhookRoutes, { prefix: '/webhooks' });
    });

    process.env['MIMIR_SECRET_DISCORD_PUBLIC_KEY_00000000-0000-0000-0000-000000000000'] =
      publicKeyHex;

    const body = JSON.stringify({ type: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signDiscordBody(body, timestamp);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/discord/00000000-0000-0000-0000-000000000000',
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ type: 1 });
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'stores an application command and starts a reply workflow',
    async () => {
      const token = `discord_webhook_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(discordWebhookRoutes, { prefix: '/webhooks' });
      });

      const user = await resolveAuthUser(token, `${token}@test.local`);
      process.env[`MIMIR_SECRET_DISCORD_PUBLIC_KEY_${user.tenantId}`] = publicKeyHex;

      await withTenantTransaction(user.tenantId, async (ctx) => {
        await createConnector(ctx, {
          kind: 'discord',
          secretRef: 'discord',
          tier: 1,
        });
      });

      const payload = {
        id: 'interaction-1',
        application_id: 'app-1',
        type: 2,
        token: 'token-1',
        user: { id: '42', username: 'Tester' },
        channel: { id: '99' },
        data: {
          name: 'mimir',
          options: [{ name: 'text', value: 'I need this from my laptop' }],
        },
      };
      const body = JSON.stringify(payload);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = signDiscordBody(body, timestamp);

      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/discord/${user.tenantId}`,
        headers: {
          'content-type': 'application/json',
          'x-signature-ed25519': signature,
          'x-signature-timestamp': timestamp,
        },
        payload: body,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.type).toBe(4);
      expect(responseBody.data.content).toContain('reply shortly');

      const session = await withTenantTransaction(user.tenantId, async (ctx) => {
        return findSessionByExternalId(ctx, 'discord', 'discord:42');
      });
      expect(session).toBeDefined();

      const messages = await withTenantTransaction(user.tenantId, async (ctx) => {
        if (!session) throw new Error('session not found');
        return getSessionMessages(ctx, session.id);
      });
      expect(messages).toHaveLength(1);
      expect(messages[0]?.role).toBe('user');
      expect(messages[0]?.content).toBe('I need this from my laptop');

      expect(startTaskWorkflow).toHaveBeenCalledTimes(1);
      const workflowCall = vi.mocked(startTaskWorkflow).mock.calls[0]?.[0];
      expect(workflowCall).toMatchObject({
        tenantId: user.tenantId,
        userId: 'discord:42',
        type: 'discord.chat',
        tier: expect.any(Number),
        payload: expect.objectContaining({
          recipientId: '42',
          channelId: '99',
          sessionId: session?.id,
          incomingText: 'I need this from my laptop',
          actor: 'discord:42',
        }),
      });
    }
  );
});
