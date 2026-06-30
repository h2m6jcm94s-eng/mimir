import {
  DiscordGetMessagesInput,
  DiscordListChannelsInput,
  DiscordSendMessageInput,
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
import { DiscordClient } from './client';

export const discordHandlers: Record<string, ConnectorActionHandler> = {
  listChannels: async (_ctx, config, input) => {
    const client = new DiscordClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = DiscordListChannelsInput.parse(input);
    const channels = await client.listChannels(parsed);
    return { channels };
  },

  getMessages: async (_ctx, config, input) => {
    const client = new DiscordClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = DiscordGetMessagesInput.parse(input);
    const messages = await client.getMessages(parsed);
    return { messages };
  },
};

connectorWriteRegistry.register({
  kind: 'discord',
  action: 'sendMessage',
  inputSchema: DiscordSendMessageInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { content: string }).content,
  approvalMessage: (input) => {
    const payload = input as { channelId: string; content: string };
    return {
      title: 'Send Discord message',
      description: `Send message to channel "${payload.channelId}": "${payload.content}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new DiscordClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as { channelId: string; content: string };
    const result = await client.sendMessage(payload);
    return { applied: true, reason: 'Message sent', output: result as Record<string, unknown> };
  },
});

async function findDiscordConfig(ctx: TenantContext): Promise<{ secretRef: string } | undefined> {
  const connector = await findConnectorByKind(ctx, 'discord');
  if (!connector || !connector.secretRef) return undefined;
  return { secretRef: connector.secretRef };
}

export const discordChatApplyHandler: ApplyHandler = async (
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
    channelId?: string;
    recipientId?: string;
    sessionId: string;
  };

  const config = await findDiscordConfig(ctx);
  if (!config) {
    return { applied: false, reason: 'Discord connector not configured', output: {} };
  }

  const client = new DiscordClient(
    { tenantId: ctx.tenantId, secretRef: config.secretRef },
    secrets
  );

  let result: unknown;
  if (payload.recipientId) {
    result = await client.sendDm({ recipientId: payload.recipientId, content: replyText });
  } else if (payload.channelId) {
    result = await client.sendMessage({ channelId: payload.channelId, content: replyText });
  } else {
    return { applied: false, reason: 'No Discord channel or recipient provided', output: {} };
  }

  await createMessage(ctx, {
    sessionId: payload.sessionId,
    role: 'assistant',
    content: replyText,
    tier: input.tier,
  });

  return {
    applied: true,
    reason: 'Discord reply sent',
    output: result as Record<string, unknown>,
  };
};
