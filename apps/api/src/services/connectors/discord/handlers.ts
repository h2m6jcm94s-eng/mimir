import {
  DiscordGetMessagesInput,
  DiscordListChannelsInput,
  DiscordSendMessageInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
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
