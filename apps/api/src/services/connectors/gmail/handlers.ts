import {
  GmailGetMessageInput,
  GmailListMessagesInput,
  GmailSendMessageInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { ConnectorActionHandler } from '../registry';
import { connectorWriteRegistry } from '../write-registry';
import { GmailClient } from './client';

export const gmailHandlers: Record<string, ConnectorActionHandler> = {
  listMessages: async (_ctx, config, input) => {
    const client = new GmailClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = GmailListMessagesInput.parse(input);
    const messages = await client.listMessages(parsed);
    return { messages };
  },

  getMessage: async (_ctx, config, input) => {
    const client = new GmailClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = GmailGetMessageInput.parse(input);
    const message = await client.getMessage(parsed);
    return { message };
  },
};

connectorWriteRegistry.register({
  kind: 'gmail',
  action: 'sendMessage',
  inputSchema: GmailSendMessageInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { subject: string }).subject,
  approvalMessage: (input) => {
    const payload = input as { to: string; subject: string };
    return {
      title: 'Send Gmail message',
      description: `Send email to "${payload.to}" with subject "${payload.subject}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new GmailClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as { to: string; subject: string; body: string };
    const result = await client.sendMessage(payload);
    return { applied: true, reason: 'Email sent', output: result as Record<string, unknown> };
  },
});
