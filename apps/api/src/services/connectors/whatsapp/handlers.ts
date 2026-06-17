import { WhatsAppGetBusinessProfileInput, WhatsAppSendMessageInput } from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import { MetaClient } from '../meta/client';
import type { ConnectorActionHandler } from '../registry';
import { connectorWriteRegistry } from '../write-registry';

export const whatsappHandlers: Record<string, ConnectorActionHandler> = {
  getBusinessProfile: async (_ctx, config, input) => {
    const client = new MetaClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = WhatsAppGetBusinessProfileInput.parse(input);
    const profile = await client.getBusinessProfile(parsed);
    return { profile };
  },
};

connectorWriteRegistry.register({
  kind: 'whatsapp',
  action: 'sendMessage',
  inputSchema: WhatsAppSendMessageInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { text: string }).text,
  approvalMessage: (input) => {
    const payload = input as { phoneNumberId: string; to: string; text: string };
    return {
      title: 'Send WhatsApp message',
      description: `Send message from "${payload.phoneNumberId}" to "${payload.to}": "${payload.text}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new MetaClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as { phoneNumberId: string; to: string; text: string };
    const result = await client.sendWhatsAppMessage(payload);
    return {
      applied: true,
      reason: 'WhatsApp message sent',
      output: result as Record<string, unknown>,
    };
  },
});
