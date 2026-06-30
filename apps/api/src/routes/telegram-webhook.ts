import { TelegramUpdate } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { findConnectorByKind } from '../repositories/connector';
import { createJob } from '../repositories/job';
import { getSessionMessages } from '../repositories/session';
import { ClassificationGateway } from '../services/classification/gateway';
import {
  buildChatPrompt,
  dedupeUpdate,
  findOrCreateChatSession,
  startReplyWorkflow,
  storeUserMessage,
  verifySecretToken,
} from '../services/connectors/chat-webhook-framework';

const paramsSchema = z.object({
  tenantId: z.string().uuid(),
});

const TELEGRAM_WEBHOOK_SECRET_ALIAS = 'telegram_webhook_secret';
const UPDATE_ID_TTL_SECONDS = 24 * 60 * 60; // 24 hours

interface TelegramWebhookPayload {
  updateId: number;
  chatId: number | string;
  fromId: number;
  text: string;
  messageId: number;
}

function extractMessage(
  update: z.infer<typeof TelegramUpdate>
): TelegramWebhookPayload | undefined {
  const message =
    update.message ?? update.edited_message ?? update.channel_post ?? update.edited_channel_post;
  if (!message?.text) return undefined;

  const chatId = message.chat.id;
  const fromId = message.from?.id ?? 0;

  return {
    updateId: update.update_id,
    chatId,
    fromId,
    text: message.text,
    messageId: message.message_id,
  };
}

export async function telegramWebhookRoutes(app: FastifyInstance) {
  app.post('/telegram/:tenantId', async (request: FastifyRequest, reply) => {
    const params = paramsSchema.safeParse(request.params);
    if (!params.success) {
      return reply
        .status(400)
        .send({ error: { code: 'INVALID_TENANT_ID', message: 'Invalid tenant id' } });
    }

    const { tenantId } = params.data;
    const secretHeader = request.headers['x-telegram-bot-api-secret-token'];
    const secretToken = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;

    if (!(await verifySecretToken(secretToken, tenantId, TELEGRAM_WEBHOOK_SECRET_ALIAS))) {
      return reply
        .status(401)
        .send({ error: { code: 'UNAUTHORIZED', message: 'Invalid secret token' } });
    }

    const parseResult = TelegramUpdate.safeParse(request.body);
    if (!parseResult.success) {
      return reply
        .status(400)
        .send({ error: { code: 'INVALID_UPDATE', message: 'Invalid Telegram update' } });
    }

    const update = parseResult.data;
    const payload = extractMessage(update);
    if (!payload) {
      return reply.status(200).send({ ok: true, reason: 'no_message' });
    }

    const isNew = await dedupeUpdate(`telegram_update:${payload.updateId}`, UPDATE_ID_TTL_SECONDS);
    if (!isNew) {
      return reply.status(200).send({ ok: true, reason: 'duplicate' });
    }

    const externalId = `telegram:${payload.chatId}`;
    const actor = `telegram:${payload.fromId}`;

    const { session, messages, job, tier } = await withTenantTransaction(tenantId, async (ctx) => {
      const connector = await findConnectorByKind(ctx, 'telegram');
      if (!connector || !connector.secretRef) {
        throw new Error(`Telegram connector not configured for tenant ${tenantId}`);
      }

      const classifier = new ClassificationGateway();
      const classification = classifier.classify({
        prompt: payload.text,
        attachments: [],
        retrievedContext: [],
      });

      const session = await findOrCreateChatSession(ctx, 'telegram', externalId);
      await storeUserMessage(ctx, session.id, payload.text, {
        platformMessageId: String(payload.messageId),
        tier: classification.tier,
      });

      const history = await getSessionMessages(ctx, session.id);
      const prompt = buildChatPrompt(
        'Telegram',
        history.map((m) => ({ role: m.role, content: m.content })),
        payload.text
      );

      const idempotencyKey = `telegram:${tenantId}:${payload.updateId}`;
      const job = await createJob(ctx, {
        idempotencyKey,
        type: 'telegram.chat',
        tier: classification.tier,
        input: {
          prompt,
          chatId: payload.chatId,
          sessionId: session.id,
          incomingText: payload.text,
          actor,
        },
      });

      return { session, messages: history, job, tier: classification.tier };
    });

    await startReplyWorkflow({
      tenantId,
      userId: actor,
      jobId: job.id,
      idempotencyKey: `telegram:${tenantId}:${payload.updateId}`,
      type: 'telegram.chat',
      tier,
      prompt: buildChatPrompt(
        'Telegram',
        messages.map((m) => ({ role: m.role, content: m.content })),
        payload.text
      ),
      payload: {
        chatId: payload.chatId,
        sessionId: session.id,
        incomingText: payload.text,
        actor,
      },
    });

    return reply.send({ ok: true, sessionId: session.id, jobId: job.id });
  });
}
