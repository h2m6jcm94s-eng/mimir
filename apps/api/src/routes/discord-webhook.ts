import { createPublicKey, randomUUID, verify } from 'node:crypto';
import { DiscordUpdate } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { findConnectorByKind } from '../repositories/connector';
import { getSessionMessages } from '../repositories/session';
import { getClassificationGateway } from '../services/classification/gateway';
import {
  buildChatPrompt,
  createChatJobWithPolicyGate,
  findOrCreateChatSession,
  startReplyWorkflow,
  storeUserMessage,
} from '../services/connectors/chat-webhook-framework';

const paramsSchema = z.object({
  tenantId: z.string().uuid(),
});

const DISCORD_PUBLIC_KEY_ALIAS = 'discord_public_key';

function extractApplicationCommandText(data: Record<string, unknown>): string | undefined {
  const options = data.options as Array<{ name: string; value: unknown }> | undefined;
  if (!Array.isArray(options)) return undefined;
  const textOption = options.find((o) => o.name === 'text' || o.name === 'message');
  if (textOption && typeof textOption.value === 'string') return textOption.value;
  return undefined;
}

function extractMessageContent(update: z.infer<typeof DiscordUpdate>): {
  userId: string;
  channelId?: string;
  text: string;
  messageId?: string;
} | null {
  if (update.message?.content && !update.message.author?.bot) {
    return {
      userId: update.message.author.id,
      channelId: update.message.channel_id,
      text: update.message.content,
      messageId: update.message.id,
    };
  }

  if (update.type === 2 && update.data) {
    const text = extractApplicationCommandText(update.data);
    const user = update.user ?? update.member?.user;
    if (!text || !user) return null;
    return {
      userId: user.id,
      channelId: update.channel?.id,
      text,
      messageId: update.id,
    };
  }

  return null;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}

async function verifyDiscordSignature(
  tenantId: string,
  signature: string | undefined,
  timestamp: string | undefined,
  body: string
): Promise<boolean> {
  if (!signature || !timestamp) return false;
  const { secrets } = await import('../config/secrets.js');
  const publicKey = await secrets.getForTenant(tenantId, DISCORD_PUBLIC_KEY_ALIAS);
  if (!publicKey) return false;

  const keyBytes = Buffer.from(publicKey, 'hex');
  const sigBytes = Buffer.from(signature, 'hex');
  if (keyBytes.length !== 32 || sigBytes.length !== 64) return false;

  const publicKeyObject = createPublicKey({
    key: {
      kty: 'OKP',
      crv: 'Ed25519',
      x: base64UrlEncode(keyBytes),
    },
    format: 'jwk',
  });

  const message = Buffer.from(timestamp + body);

  try {
    return verify(null, message, publicKeyObject, sigBytes);
  } catch {
    return false;
  }
}

interface DiscordWebhookRequest extends FastifyRequest {
  rawBody: string;
}

export async function discordWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (request, body, done) => {
    const raw = body.toString('utf8');
    (request as unknown as DiscordWebhookRequest).rawBody = raw;
    try {
      done(null, JSON.parse(raw));
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  app.post('/discord/:tenantId', async (request: FastifyRequest, reply) => {
    const discordRequest = request as DiscordWebhookRequest;
    const params = paramsSchema.safeParse(discordRequest.params);
    if (!params.success) {
      return reply
        .status(400)
        .send({ error: { code: 'INVALID_TENANT_ID', message: 'Invalid tenant id' } });
    }

    const { tenantId } = params.data;
    const signature = discordRequest.headers['x-signature-ed25519'];
    const timestamp = discordRequest.headers['x-signature-timestamp'];
    const body = discordRequest.rawBody;
    if (!body) {
      return reply
        .status(400)
        .send({ error: { code: 'MISSING_RAW_BODY', message: 'Raw body required' } });
    }

    if (
      !(await verifyDiscordSignature(
        tenantId,
        Array.isArray(signature) ? signature[0] : signature,
        Array.isArray(timestamp) ? timestamp[0] : timestamp,
        body
      ))
    ) {
      return reply.status(401).send({ error: 'Invalid request signature' });
    }

    const parseResult = DiscordUpdate.safeParse(request.body);
    if (!parseResult.success) {
      return reply
        .status(400)
        .send({ error: { code: 'INVALID_UPDATE', message: 'Invalid Discord update' } });
    }

    const update = parseResult.data;

    // Ping
    if (update.type === 1) {
      return reply.send({ type: 1 });
    }

    const message = extractMessageContent(update);
    if (!message) {
      return reply.status(200).send({ ok: true, reason: 'no_message' });
    }

    const externalId = `discord:${message.userId}`;
    const actor = `discord:${message.userId}`;

    const { session, messages, job, tier, approvalId } = await withTenantTransaction(
      tenantId,
      async (ctx) => {
        const connector = await findConnectorByKind(ctx, 'discord');
        if (!connector || !connector.secretRef) {
          throw new Error(`Discord connector not configured for tenant ${tenantId}`);
        }

        const classifier = getClassificationGateway();
        const classification = classifier.classify({
          prompt: message.text,
          attachments: [],
          retrievedContext: [],
        });

        const session = await findOrCreateChatSession(ctx, 'discord', externalId);
        await storeUserMessage(ctx, session.id, message.text, {
          platformMessageId: message.messageId,
          tier: classification.tier,
        });

        const history = await getSessionMessages(ctx, session.id);
        const prompt = buildChatPrompt(
          'Discord',
          history.map((m) => ({ role: m.role, content: m.content })),
          message.text
        );

        const idempotencyKey = `discord:${tenantId}:${message.userId}:${randomUUID()}`;
        const { job, approvalId } = await createChatJobWithPolicyGate(ctx, {
          tenantId,
          actor,
          type: 'discord.chat',
          tier: classification.tier,
          idempotencyKey,
          prompt,
          input: {
            prompt,
            recipientId: message.userId,
            channelId: message.channelId,
            sessionId: session.id,
            incomingText: message.text,
            actor,
          },
        });

        return { session, messages: history, job, tier: classification.tier, approvalId };
      }
    );

    if (approvalId) {
      if (update.type === 2) {
        return reply.send({
          type: 4,
          data: { content: 'This request requires approval before proceeding.' },
        });
      }
      return reply.status(202).send({
        ok: true,
        sessionId: session.id,
        jobId: job.id,
        approvalId,
      });
    }

    await startReplyWorkflow({
      tenantId,
      userId: actor,
      jobId: job.id,
      idempotencyKey: `discord:${tenantId}:${message.userId}:${randomUUID()}`,
      type: 'discord.chat',
      tier,
      source: 'chat',
      prompt: buildChatPrompt(
        'Discord',
        messages.map((m) => ({ role: m.role, content: m.content })),
        message.text
      ),
      payload: {
        recipientId: message.userId,
        channelId: message.channelId,
        sessionId: session.id,
        incomingText: message.text,
        actor,
      },
    });

    // Acknowledge the interaction immediately if it's an application command.
    if (update.type === 2) {
      return reply.send({
        type: 4,
        data: { content: 'Got it — I will reply shortly.' },
      });
    }

    return reply.send({ ok: true, sessionId: session.id, jobId: job.id });
  });
}
