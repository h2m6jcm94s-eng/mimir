import {
  InstagramGetMediaInput,
  InstagramListMediaInput,
  InstagramPublishMediaInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import { MetaClient } from '../meta/client';
import type { ConnectorActionHandler } from '../registry';
import { connectorWriteRegistry } from '../write-registry';

export const instagramHandlers: Record<string, ConnectorActionHandler> = {
  listMedia: async (_ctx, config, input) => {
    const client = new MetaClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = InstagramListMediaInput.parse(input);
    const media = await client.listMedia(parsed);
    return { media };
  },

  getMedia: async (_ctx, config, input) => {
    const client = new MetaClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = InstagramGetMediaInput.parse(input);
    const item = await client.getMedia(parsed);
    return { media: item };
  },
};

connectorWriteRegistry.register({
  kind: 'instagram',
  action: 'publishMedia',
  inputSchema: InstagramPublishMediaInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { caption: string }).caption,
  approvalMessage: (input) => {
    const payload = input as { igUserId: string; imageUrl: string; caption: string };
    return {
      title: 'Publish Instagram media',
      description: `Publish post for user "${payload.igUserId}" with caption "${payload.caption}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new MetaClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as { igUserId: string; imageUrl: string; caption: string };
    const result = await client.publishMedia(payload);
    return {
      applied: true,
      reason: 'Instagram media published',
      output: result as Record<string, unknown>,
    };
  },
});
