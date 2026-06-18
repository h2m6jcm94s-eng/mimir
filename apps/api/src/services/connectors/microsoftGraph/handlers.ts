import {
  MicrosoftGraphGetMessageInput,
  MicrosoftGraphListMessagesInput,
  MicrosoftGraphSendMessageInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { ConnectorActionHandler } from '../registry';
import { connectorWriteRegistry } from '../write-registry';
import { MicrosoftGraphClient } from './client';

export const microsoftGraphHandlers: Record<string, ConnectorActionHandler> = {
  listMessages: async (_ctx, config, input) => {
    const client = new MicrosoftGraphClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = MicrosoftGraphListMessagesInput.parse(input);
    const messages = await client.listMessages(parsed);
    return { messages };
  },

  getMessage: async (_ctx, config, input) => {
    const client = new MicrosoftGraphClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = MicrosoftGraphGetMessageInput.parse(input);
    const message = await client.getMessage(parsed);
    return { message };
  },
};

connectorWriteRegistry.register({
  kind: 'microsoftGraph',
  action: 'sendMessage',
  inputSchema: MicrosoftGraphSendMessageInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { subject: string }).subject,
  approvalMessage: (input) => {
    const payload = input as { to: string; subject: string };
    return {
      title: 'Send Outlook message',
      description: `Send email to "${payload.to}" with subject "${payload.subject}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new MicrosoftGraphClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as { to: string; subject: string; body: string };
    const result = await client.sendMessage(payload);
    return { applied: true, reason: 'Email sent', output: result as Record<string, unknown> };
  },
});
