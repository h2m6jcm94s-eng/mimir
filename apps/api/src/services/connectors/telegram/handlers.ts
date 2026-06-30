import {
  TelegramGetChatInput,
  TelegramSendMessageInput,
  TelegramSetWebhookInput,
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
import { TelegramClient } from './client';

export const telegramHandlers: Record<string, ConnectorActionHandler> = {
  getChat: async (_ctx, config, input) => {
    const client = new TelegramClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = TelegramGetChatInput.parse(input);
    const chat = await client.getChat(parsed);
    return { chat };
  },

  setWebhook: async (_ctx, config, input) => {
    const client = new TelegramClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = TelegramSetWebhookInput.parse(input);
    const result = await client.setWebhook(parsed);
    return { result };
  },
};

connectorWriteRegistry.register({
  kind: 'telegram',
  action: 'sendMessage',
  inputSchema: TelegramSendMessageInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { text: string }).text,
  approvalMessage: (input) => {
    const payload = input as { chatId: string | number; text: string };
    return {
      title: 'Send Telegram message',
      description: `Send message to chat "${payload.chatId}": "${payload.text}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new TelegramClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as { chatId: string | number; text: string };
    const result = await client.sendMessage(payload);
    return {
      applied: true,
      reason: 'Message sent',
      output: result as Record<string, unknown>,
    };
  },
});

async function findTelegramConfig(ctx: TenantContext): Promise<{ secretRef: string } | undefined> {
  const connector = await findConnectorByKind(ctx, 'telegram');
  if (!connector || !connector.secretRef) return undefined;
  return { secretRef: connector.secretRef };
}

export const telegramChatApplyHandler: ApplyHandler = async (
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
    chatId: number | string;
    sessionId: string;
  };

  const config = await findTelegramConfig(ctx);
  if (!config) {
    return { applied: false, reason: 'Telegram connector not configured', output: {} };
  }

  const client = new TelegramClient(
    { tenantId: ctx.tenantId, secretRef: config.secretRef },
    secrets
  );

  const result = await client.sendMessage({ chatId: payload.chatId, text: replyText });

  await createMessage(ctx, {
    sessionId: payload.sessionId,
    role: 'assistant',
    content: replyText,
    tier: input.tier,
  });

  return {
    applied: true,
    reason: 'Telegram reply sent',
    output: result as Record<string, unknown>,
  };
};
