import { GoogleDocsCreateDocumentInput, GoogleDocsGetDocumentInput } from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { ConnectorActionHandler } from '../registry';
import { connectorWriteRegistry } from '../write-registry';
import { GoogleDocsClient } from './client';

export const googleDocsHandlers: Record<string, ConnectorActionHandler> = {
  getDocument: async (_ctx, config, input) => {
    const client = new GoogleDocsClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = GoogleDocsGetDocumentInput.parse(input);
    const document = await client.getDocument(parsed);
    return { document };
  },
};

connectorWriteRegistry.register({
  kind: 'googleDocs',
  action: 'createDocument',
  inputSchema: GoogleDocsCreateDocumentInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { title: string }).title,
  approvalMessage: (input) => {
    const payload = input as { title: string };
    return {
      title: 'Create Google Doc',
      description: `Create document "${payload.title}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new GoogleDocsClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as { title: string };
    const result = await client.createDocument(payload);
    return { applied: true, reason: 'Document created', output: result as Record<string, unknown> };
  },
});
