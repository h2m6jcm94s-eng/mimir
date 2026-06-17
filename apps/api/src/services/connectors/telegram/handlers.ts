import { TelegramGetChatInput, TelegramSendMessageInput } from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
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
