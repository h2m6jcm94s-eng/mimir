import {
  SlackGetMessagesInput,
  SlackListChannelsInput,
  SlackSendMessageInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { TenantContext } from '../../../db/tenant-context';
import { findConnectorByKind } from '../../../repositories/connector';
import { createMessage } from '../../../repositories/session';
import type {
  ApplyDraft,
  ApplyHandler,
  ApplyInput,
  ApplyResult,
} from '../../../services/apply/registry';
import type { ConnectorActionHandler } from '../registry';
import { connectorWriteRegistry } from '../write-registry';
import { SlackClient } from './client';

export const slackHandlers: Record<string, ConnectorActionHandler> = {
  listChannels: async (_ctx, config, input) => {
    const client = new SlackClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = SlackListChannelsInput.parse(input);
    const channels = await client.listChannels(parsed);
    return { channels };
  },

  getMessages: async (_ctx, config, input) => {
    const client = new SlackClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = SlackGetMessagesInput.parse(input);
    const messages = await client.getMessages(parsed);
    return { messages };
  },
};

connectorWriteRegistry.register({
  kind: 'slack',
  action: 'sendMessage',
  inputSchema: SlackSendMessageInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { text: string }).text,
  approvalMessage: (input) => {
    const payload = input as { channelId: string; text: string };
    return {
      title: 'Send Slack message',
      description: `Send message to channel "${payload.channelId}": "${payload.text}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new SlackClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as { channelId: string; text: string };
    const result = await client.sendMessage(payload);
    return { applied: true, reason: 'Message sent', output: result as Record<string, unknown> };
  },
});

async function findSlackConfig(ctx: TenantContext): Promise<{ secretRef: string } | undefined> {
  const connector = await findConnectorByKind(ctx, 'slack');
  if (!connector || !connector.secretRef) return undefined;
  return { secretRef: connector.secretRef };
}

export const slackChatApplyHandler: ApplyHandler = async (
  ctx: TenantContext,
  input: ApplyInput,
  draft: ApplyDraft
): Promise<ApplyResult> => {
  const modelOutput = draft.artifacts.model as { text?: string } | undefined;
  const replyText = modelOutput?.text?.trim();
  if (!replyText) {
    return { applied: false, reason: 'Model produced no reply text', output: {} };
  }

  const payload = input.payload as {
    channelId: string;
    threadTs?: string;
    sessionId: string;
  };

  const config = await findSlackConfig(ctx);
  if (!config) {
    return { applied: false, reason: 'Slack connector not configured', output: {} };
  }

  const client = new SlackClient({ tenantId: ctx.tenantId, secretRef: config.secretRef }, secrets);

  const result = await client.sendMessage({
    channelId: payload.channelId,
    text: replyText,
    threadTs: payload.threadTs,
  });

  await createMessage(ctx, {
    sessionId: payload.sessionId,
    role: 'assistant',
    content: replyText,
    tier: input.tier,
  });

  return {
    applied: true,
    reason: 'Slack reply sent',
    output: result as Record<string, unknown>,
  };
};
