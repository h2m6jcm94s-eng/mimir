import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { createConnector } from '../repositories/connector';
import { getJob } from '../repositories/job';
import { findSessionByExternalId, getSessionMessages } from '../repositories/session';
import { startTaskWorkflow } from '../temporal/client';
import { buildTestApp } from '../test-helpers/build-app';
import { telegramWebhookRoutes } from './telegram-webhook';

vi.mock('../db/redis', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('../temporal/client', () => ({
  startTaskWorkflow: vi.fn().mockResolvedValue({ workflowId: 'wf-1', runId: 'run-1' }),
}));

describe('telegram webhook routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('returns 401 without secret token', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(telegramWebhookRoutes, { prefix: '/webhooks' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/telegram/00000000-0000-0000-0000-000000000000',
      payload: { update_id: 1, message: { message_id: 1, date: 1, chat: { id: 1 }, text: 'hi' } },
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'stores a Telegram message and requires approval before replying',
    async () => {
      const token = `telegram_webhook_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(telegramWebhookRoutes, { prefix: '/webhooks' });
      });

      const user = await resolveAuthUser(token, `${token}@test.local`);
      process.env[`MIMIR_SECRET_TELEGRAM_WEBHOOK_SECRET_${user.tenantId}`] = 'webhook-secret';

      await withTenantTransaction(user.tenantId, async (ctx) => {
        await createConnector(ctx, {
          kind: 'telegram',
          secretRef: 'telegram',
          tier: 1,
        });
      });

      const response = await app.inject({
        method: 'POST',
        url: `/webhooks/telegram/${user.tenantId}`,
        headers: { 'x-telegram-bot-api-secret-token': 'webhook-secret' },
        payload: {
          update_id: 123,
          message: {
            message_id: 1,
            date: 1_700_000_000,
            from: { id: 42, first_name: 'Tester' },
            chat: { id: 99, type: 'private' },
            text: 'I need this from my laptop',
          },
        },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.jobId).toBeDefined();
      expect(body.approvalId).toBeDefined();

      const session = await withTenantTransaction(user.tenantId, async (ctx) => {
        return findSessionByExternalId(ctx, 'telegram', 'telegram:99');
      });
      expect(session).toBeDefined();

      const messages = await withTenantTransaction(user.tenantId, async (ctx) => {
        if (!session) throw new Error('session not found');
        return getSessionMessages(ctx, session.id);
      });
      expect(messages).toHaveLength(1);
      expect(messages[0]?.role).toBe('user');
      expect(messages[0]?.content).toBe('I need this from my laptop');
      expect(messages[0]?.platformMessageId).toBe('1');

      const job = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getJob(ctx, body.jobId);
      });
      expect(job?.status).toBe('blocked');
      expect(job?.source).toBe('chat');

      expect(startTaskWorkflow).not.toHaveBeenCalled();
    }
  );
});
