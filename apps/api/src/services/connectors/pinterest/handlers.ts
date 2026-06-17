import {
  PinterestCreatePinInput,
  PinterestListBoardsInput,
  PinterestListPinsInput,
} from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { ConnectorActionHandler } from '../registry';
import { connectorWriteRegistry } from '../write-registry';
import { PinterestClient } from './client';

export const pinterestHandlers: Record<string, ConnectorActionHandler> = {
  listBoards: async (_ctx, config, input) => {
    const client = new PinterestClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = PinterestListBoardsInput.parse(input);
    const boards = await client.listBoards(parsed);
    return { boards };
  },

  listPins: async (_ctx, config, input) => {
    const client = new PinterestClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const parsed = PinterestListPinsInput.parse(input);
    const pins = await client.listPins(parsed);
    return { pins };
  },
};

connectorWriteRegistry.register({
  kind: 'pinterest',
  action: 'createPin',
  inputSchema: PinterestCreatePinInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => (input as { title: string }).title,
  approvalMessage: (input) => {
    const payload = input as {
      boardId: string;
      title: string;
      description: string;
    };
    return {
      title: 'Create Pinterest pin',
      description: `Create pin "${payload.title}" on board "${payload.boardId}"`,
    };
  },
  apply: async (_ctx, config, input) => {
    const client = new PinterestClient(
      { tenantId: config.tenantId, secretRef: config.secretRef },
      secrets
    );
    const payload = input as {
      boardId: string;
      title: string;
      description: string;
      link?: string;
      mediaSource: string;
    };
    const result = await client.createPin(payload);
    return {
      applied: true,
      reason: 'Pinterest pin created',
      output: result as Record<string, unknown>,
    };
  },
});
