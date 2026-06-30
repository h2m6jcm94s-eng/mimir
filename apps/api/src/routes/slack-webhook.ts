import { createHmac, timingSafeEqual } from 'node:crypto';
import { SlackWebhookBody } from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { secrets } from '../config/secrets';
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
} from '../services/connectors/chat-webhook-framework';

const paramsSchema = z.object({
  tenantId: z.string().uuid(),
});

const SLACK_SIGNING_SECRET_ALIAS = 'slack_signing_secret';
const EVENT_ID_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const SIGNATURE_MAX_AGE_SECONDS = 5 * 60; // 5 minutes

interface SlackWebhookRequest extends FastifyRequest {
  rawBody: string;
}

function isWithinReplayWindow(timestamp: string): boolean {
  const ts = Number.parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) <= SIGNATURE_MAX_AGE_SECONDS;
}

async function verifySlackSignature(
  tenantId: string,
  signature: string | undefined,
  timestamp: string | undefined,
  body: string
): Promise<boolean> {
  if (!signature || !timestamp) return false;
  if (!signature.startsWith('v0=')) return false;
  if (!isWithinReplayWindow(timestamp)) return false;

  const signingSecret = await secrets.getForTenant(tenantId, SLACK_SIGNING_SECRET_ALIAS);
  if (!signingSecret) return false;

  const expected = createHmac('sha256', signingSecret)
    .update(`v0:${timestamp}:${body}`, 'utf8')
    .digest('hex');

  const actual = signature.slice(3);
  const actualLen = Buffer.byteLength(actual);
  const expectedLen = Buffer.byteLength(expected);
  if (actualLen !== expectedLen) return false;

  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function extractMessageContent(event: {
  type: string;
  user?: string;
  channel?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  bot_id?: string;
}): {
  userId: string;
  channelId: string;
  text: string;
  ts: string;
  threadTs?: string;
} | null {
  if (event.type !== 'message' || !event.text || !event.user || !event.channel || !event.ts) {
    return null;
  }
  if (event.bot_id) return null;

  return {
    userId: event.user,
    channelId: event.channel,
    text: event.text,
    ts: event.ts,
    threadTs: event.thread_ts,
  };
}

export async function slackWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (request, body, done) => {
    const raw = body.toString('utf8');
    (request as unknown as SlackWebhookRequest).rawBody = raw;
    try {
      done(null, JSON.parse(raw));
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  app.post('/slack/:tenantId', async (request: FastifyRequest, reply) => {
    const slackRequest = request as SlackWebhookRequest;
    const params = paramsSchema.safeParse(slackRequest.params);
    if (!params.success) {
      return reply
        .status(400)
        .send({ error: { code: 'INVALID_TENANT_ID', message: 'Invalid tenant id' } });
    }

    const { tenantId } = params.data;
    const signatureHeader = slackRequest.headers['x-slack-signature'];
    const timestampHeader = slackRequest.headers['x-slack-request-timestamp'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const timestamp = Array.isArray(timestampHeader) ? timestampHeader[0] : timestampHeader;
    const body = slackRequest.rawBody ?? JSON.stringify(slackRequest.body);

    if (!(await verifySlackSignature(tenantId, signature, timestamp, body))) {
      return reply.status(401).send({ error: 'Invalid request signature' });
    }

    const parseResult = SlackWebhookBody.safeParse(request.body);
    if (!parseResult.success) {
      return reply
        .status(400)
        .send({ error: { code: 'INVALID_UPDATE', message: 'Invalid Slack webhook body' } });
    }

    const update = parseResult.data;

    if (update.type === 'url_verification') {
      return reply.send({ challenge: update.challenge });
    }

    if (update.type !== 'event_callback') {
      return reply.status(200).send({ ok: true, reason: 'ignored_type' });
    }

    const eventId = (update as unknown as { event_id?: string }).event_id;
    if (!eventId) {
      return reply
        .status(400)
        .send({ error: { code: 'MISSING_EVENT_ID', message: 'Missing event_id' } });
    }

    const isNew = await dedupeUpdate(`slack_event:${tenantId}:${eventId}`, EVENT_ID_TTL_SECONDS);
    if (!isNew) {
      return reply.status(200).send({ ok: true, reason: 'duplicate' });
    }

    const message = extractMessageContent(
      update.event as {
        type: string;
        user?: string;
        channel?: string;
        text?: string;
        ts?: string;
        thread_ts?: string;
        bot_id?: string;
      }
    );
    if (!message) {
      return reply.status(200).send({ ok: true, reason: 'no_message' });
    }

    const externalId = message.threadTs
      ? `slack:${message.channelId}:${message.threadTs}`
      : `slack:${message.channelId}`;
    const actor = `slack:${message.userId}`;

    const { session, messages, job, tier } = await withTenantTransaction(tenantId, async (ctx) => {
      const connector = await findConnectorByKind(ctx, 'slack');
      if (!connector || !connector.secretRef) {
        throw new Error(`Slack connector not configured for tenant ${tenantId}`);
      }

      const classifier = new ClassificationGateway();
      const classification = classifier.classify({
        prompt: message.text,
        attachments: [],
        retrievedContext: [],
      });

      const session = await findOrCreateChatSession(ctx, 'slack', externalId);
      await storeUserMessage(ctx, session.id, message.text, {
        platformMessageId: message.ts,
        tier: classification.tier,
      });

      const history = await getSessionMessages(ctx, session.id);
      const prompt = buildChatPrompt(
        'Slack',
        history.map((m) => ({ role: m.role, content: m.content })),
        message.text
      );

      const idempotencyKey = `slack:${tenantId}:${eventId}`;
      const job = await createJob(ctx, {
        idempotencyKey,
        type: 'slack.chat',
        tier: classification.tier,
        input: {
          prompt,
          channelId: message.channelId,
          threadTs: message.threadTs,
          sessionId: session.id,
          incomingText: message.text,
          actor,
        },
      });

      return { session, messages: history, job, tier: classification.tier };
    });

    await startReplyWorkflow({
      tenantId,
      userId: actor,
      jobId: job.id,
      idempotencyKey: `slack:${tenantId}:${eventId}`,
      type: 'slack.chat',
      tier,
      prompt: buildChatPrompt(
        'Slack',
        messages.map((m) => ({ role: m.role, content: m.content })),
        message.text
      ),
      payload: {
        channelId: message.channelId,
        threadTs: message.threadTs,
        sessionId: session.id,
        incomingText: message.text,
        actor,
      },
    });

    return reply.send({ ok: true, sessionId: session.id, jobId: job.id });
  });
}
