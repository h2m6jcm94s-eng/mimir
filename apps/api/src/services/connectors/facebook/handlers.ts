import {
  FacebookListPagesInput,
  FacebookListPostsInput,
  FacebookPublishPostInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import { MetaClient } from '../meta/client';
import type { ConnectorActionHandler } from '../registry';
import { connectorWriteRegistry } from '../write-registry';

export const facebookHandlers: Record<string, ConnectorActionHandler> = {
  listPages: async (_ctx, config, input) => {
    const client = new MetaClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = FacebookListPagesInput.parse(input);
    const pages = await client.listPages(parsed);
    return { pages };
  },

  listPosts: async (_ctx, config, input) => {
    const client = new MetaClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = FacebookListPostsInput.parse(input);
    const posts = await client.listPosts(parsed);
    return { posts };
  },
};

connectorWriteRegistry.register({
  kind: 'facebook',
  action: 'publishPost',
  inputSchema: FacebookPublishPostInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { message: string }).message,
  approvalMessage: (input) => {
    const payload = input as { pageId: string; message: string; link?: string };
    return {
      title: 'Publish Facebook post',
      description: `Publish post to page "${payload.pageId}": "${payload.message}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new MetaClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as { pageId: string; message: string; link?: string };
    const result = await client.publishPost(payload);
    return {
      applied: true,
      reason: 'Facebook post published',
      output: result as Record<string, unknown>,
    };
  },
});
