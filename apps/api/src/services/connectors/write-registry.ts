import type { ConnectorKind } from '@mimir/shared-types';
import type { z } from 'zod';
import type { SecretResolver } from '../../config/secrets';
import { secrets } from '../../config/secrets';
import type { TenantContext } from '../../db/tenant-context';
import { findConnectorByKind } from '../../repositories/connector';
import type { ApplyHandler, ApplyResult } from '../apply/registry';

export interface ConnectorApplyConfig {
  tenantId: string;
  kind: ConnectorKind;
  account: string | null;
  secretRef: string;
}

export type ConnectorApplyFn = (
  ctx: TenantContext,
  config: ConnectorApplyConfig,
  input: unknown,
  deps: { secrets: SecretResolver }
) => ApplyResult | Promise<ApplyResult>;

export interface ConnectorWriteApprovalMessage {
  title: string;
  description: string;
}

export interface ConnectorWriteDescriptor {
  kind: ConnectorKind;
  action: string;
  inputSchema: z.ZodType<unknown>;
  /** Short human-readable preview used for classification when no explicit tier is supplied. */
  preview: (input: unknown) => string;
  /** Build the approval title/description from the parsed input. */
  approvalMessage: (input: unknown) => ConnectorWriteApprovalMessage;
  apply: ConnectorApplyFn;
}

export class ConnectorWriteRegistry {
  private descriptors = new Map<string, ConnectorWriteDescriptor>();

  register(descriptor: ConnectorWriteDescriptor): void {
    this.descriptors.set(`${descriptor.kind}.${descriptor.action}`, descriptor);
  }

  get(kind: ConnectorKind, action: string): ConnectorWriteDescriptor | undefined {
    return this.descriptors.get(`${kind}.${action}`);
  }

  has(kind: ConnectorKind, action: string): boolean {
    return this.descriptors.has(`${kind}.${action}`);
  }

  values(): IterableIterator<ConnectorWriteDescriptor> {
    return this.descriptors.values();
  }

  /** Returns an ApplyHandler that can be registered with the Temporal ApplyRegistry. */
  applyHandlerFor(descriptor: ConnectorWriteDescriptor): ApplyHandler {
    return async (ctx, input, _draft, review): Promise<ApplyResult> => {
      if (!review.approved) {
        return {
          applied: false,
          reason: 'Review did not approve the action',
          output: {},
        };
      }

      const connector = await findConnectorByKind(ctx, descriptor.kind);
      if (!connector) {
        return {
          applied: false,
          reason: `${descriptor.kind} connector not configured`,
          output: {},
        };
      }

      if (input.tier < connector.tier) {
        return {
          applied: false,
          reason: `TIER_VIOLATION: job tier ${input.tier} is more private than connector tier ${connector.tier}`,
          output: {},
        };
      }

      const parseResult = descriptor.inputSchema.safeParse(input.payload);
      if (!parseResult.success) {
        return {
          applied: false,
          reason: `Invalid payload: ${parseResult.error.message}`,
          output: {},
        };
      }

      const config: ConnectorApplyConfig = {
        tenantId: input.tenantId,
        kind: descriptor.kind,
        account: connector.account ?? null,
        secretRef: connector.secretRef ?? '',
      };

      try {
        return await descriptor.apply(ctx, config, parseResult.data, { secrets });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          applied: false,
          reason: message,
          output: {},
        };
      }
    };
  }
}

export const connectorWriteRegistry = new ConnectorWriteRegistry();
