import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { createConnector } from '../repositories/connector';
import { findSessionByExternalId, getSessionMessages } from '../repositories/session';
import { startTaskWorkflow } from '../temporal/client';
import { buildTestApp } from '../test-helpers/build-app';
import { slackWebhookRoutes } from './slack-webhook';

const SIGNING_SECRET = 'test-slack-signing-secret';

function signSlackBody(body: string, timestamp: string, secret: string): string {
  const signature = createHmac('sha256', secret)
    .update(`v0:${timestamp}:${body}`, 'utf8')
    .digest('hex');
  return `v0=${signature}`;
}

vi.mock('../db/redis', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('../temporal/client', () => ({
  startTaskWorkflow: vi.fn().mockResolvedValue({ workflowId: 'wf-1', runId: 'run-1' }),
}));

describe('slack webhook routes', () => {
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
      await app.register(slackWebhookRoutes, { prefix: '/webhooks' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/slack/00000000-0000-0000-0000-000000000000',
      payload: { type: 'url_verification', challenge: 'challenge-1' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('responds to Slack URL verification challenge', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(slackWebhookRoutes, { prefix: '/webhooks' });
    });

    process.env['MIMIR_SECRET_SLACK_SIGNING_SECRET_00000000-0000-0000-0000-000000000000'] =
      SIGNING_SECRET;

    const body = JSON.stringify({
      type: 'url_verification',
      token: 'token-1',
      challenge: 'challenge-1',
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signSlackBody(body, timestamp, SIGNING_SECRET);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/slack/00000000-0000-0000-0000-000000000000',
      headers: {
        'content-type': 'application/json',
        'x-slack-signature': signature,
        'x-slack-request-timestamp': timestamp,
      },
      payload: body,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ challenge: 'challenge-1' });
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'stores a message event and starts a reply workflow',
    async () => {
      const token = `slack_webhook_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(slackWebhookRoutes, { prefix: '/webhooks' });
      });

      const user = await resolveAuthUser(token, `${token}@test.local`);
      process.env[`MIMIR_SECRET_SLACK_SIGNING_SECRET_${user.tenantId}`] = SIGNING_SECRET;

      await withTenantTransaction(user.tenantId, async (ctx) => {
        await createConnector(ctx, {
          kind: 'slack',
          secretRef: 'slack',
          tier: 1,
        });
      });

      const payload = {
        token: 'token-2',
        team_id: 'team-1',
        api_app_id: 'app-1',
        event_id: 'event-1',
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'U123',
          channel: 'C123',
          text: 'Hello from Slack',
          ts: '1234567890.123456',
          thread_ts: '1234567890.000000',
        },
      };
      const body = JSON.stringify(payload);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = signSlackBody(body, timestamp, SIGNING_SECRET);

      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/slack/${user.tenantId}`,
        headers: {
          'content-type': 'application/json',
          'x-slack-signature': signature,
          'x-slack-request-timestamp': timestamp,
        },
        payload: body,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.ok).toBe(true);
      expect(responseBody.sessionId).toBeDefined();
      expect(responseBody.jobId).toBeDefined();

      const session = await withTenantTransaction(user.tenantId, async (ctx) => {
        return findSessionByExternalId(ctx, 'slack', 'slack:C123:1234567890.000000');
      });
      expect(session).toBeDefined();

      const messages = await withTenantTransaction(user.tenantId, async (ctx) => {
        if (!session) throw new Error('session not found');
        return getSessionMessages(ctx, session.id);
      });
      expect(messages).toHaveLength(1);
      expect(messages[0]?.role).toBe('user');
      expect(messages[0]?.content).toBe('Hello from Slack');

      expect(startTaskWorkflow).toHaveBeenCalledTimes(1);
      const workflowCall = vi.mocked(startTaskWorkflow).mock.calls[0]?.[0];
      expect(workflowCall).toMatchObject({
        tenantId: user.tenantId,
        userId: 'slack:U123',
        type: 'slack.chat',
        tier: expect.any(Number),
        payload: expect.objectContaining({
          channelId: 'C123',
          threadTs: '1234567890.000000',
          sessionId: session?.id,
          incomingText: 'Hello from Slack',
          actor: 'slack:U123',
        }),
      });
    }
  );
});
