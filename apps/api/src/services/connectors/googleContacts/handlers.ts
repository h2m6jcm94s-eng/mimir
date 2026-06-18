import {
  GoogleContactsCreateContactInput,
  GoogleContactsGetContactInput,
  GoogleContactsListContactsInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { ConnectorActionHandler } from '../registry';
import { connectorWriteRegistry } from '../write-registry';
import { GoogleContactsClient } from './client';

export const googleContactsHandlers: Record<string, ConnectorActionHandler> = {
  listContacts: async (_ctx, config, input) => {
    const client = new GoogleContactsClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = GoogleContactsListContactsInput.parse(input);
    const contacts = await client.listContacts(parsed);
    return { contacts };
  },

  getContact: async (_ctx, config, input) => {
    const client = new GoogleContactsClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = GoogleContactsGetContactInput.parse(input);
    const contact = await client.getContact(parsed);
    return { contact };
  },
};

connectorWriteRegistry.register({
  kind: 'googleContacts',
  action: 'createContact',
  inputSchema: GoogleContactsCreateContactInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { givenName: string }).givenName,
  approvalMessage: (input) => {
    const payload = input as { givenName: string; email?: string };
    return {
      title: 'Create Google Contact',
      description: `Create contact "${payload.givenName}"${payload.email ? ` (${payload.email})` : ''}`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new GoogleContactsClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as {
      givenName: string;
      familyName?: string;
      email?: string;
      phoneNumber?: string;
    };
    const result = await client.createContact(payload);
    return { applied: true, reason: 'Contact created', output: result as Record<string, unknown> };
  },
});
