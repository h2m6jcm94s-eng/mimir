import {
  SlackGetMessagesInput,
  SlackListChannelsInput,
  SlackSendMessageInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
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
