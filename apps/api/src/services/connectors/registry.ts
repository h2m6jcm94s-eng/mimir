import { secrets } from '../../config/secrets';
import type { TenantContext } from '../../db/tenant-context';
import { createAuditEvent } from '../../repositories/audit';
import { findConnectorByKind } from '../../repositories/connector';
import { ingestDocument } from '../knowledge/ingest';
import { GitHubClient } from './github/client';

export interface ConnectorActionContext {
  tenantId: string;
  kind: string;
  action: string;
  input: Record<string, unknown>;
  requestTier: number;
  actor: string;
}

export type ConnectorActionHandler = (
  ctx: TenantContext,
  config: { tenantId: string; kind: string; account: string | null; secretRef: string },
  input: Record<string, unknown>
) => Promise<Record<string, unknown>>;

const githubHandlers: Record<string, ConnectorActionHandler> = {
  listRepos: async (_ctx, config, input) => {
    const client = new GitHubClient(config, secrets);
    const repos = await client.listRepos({
      type: (input.type as string) ?? 'all',
      perPage: (input.perPage as number) ?? 30,
    });
    return { repos };
  },

  getIssue: async (_ctx, config, input) => {
    const client = new GitHubClient(config, secrets);
    const issue = await client.getIssue({
      owner: input.owner as string,
      repo: input.repo as string,
      issueNumber: input.issueNumber as number,
    });
    return { issue };
  },

  getPullRequest: async (_ctx, config, input) => {
    const client = new GitHubClient(config, secrets);
    const pullRequest = await client.getPullRequest({
      owner: input.owner as string,
      repo: input.repo as string,
      pullNumber: input.pullNumber as number,
    });
    return { pullRequest };
  },

  ingestFile: async (ctx, config, input) => {
    const client = new GitHubClient(config, secrets);
    const file = await client.getFile({
      owner: input.owner as string,
      repo: input.repo as string,
      path: input.path as string,
      ref: input.ref as string | undefined,
    });

    if (file.encoding !== 'base64') {
      throw new Error(`Unsupported file encoding: ${file.encoding}`);
    }

    const content = Buffer.from(file.content, 'base64').toString('utf-8');
    const ingestResult = await ingestDocument(ctx, {
      kind: 'code',
      uri: `https://github.com/${input.owner}/${input.repo}/blob/${input.ref ?? 'HEAD'}/${input.path}`,
      content,
    });

    return {
      itemId: ingestResult.itemId,
      chunks: ingestResult.chunks,
      tier: ingestResult.tier,
      path: file.path,
    };
  },
};

const handlersByKind: Record<string, Record<string, ConnectorActionHandler>> = {
  github: githubHandlers,
};

export class ConnectorRegistry {
  async runAction(
    ctx: TenantContext,
    actionCtx: ConnectorActionContext
  ): Promise<{ success: boolean; result: Record<string, unknown> }> {
    const connector = await findConnectorByKind(ctx, actionCtx.kind as 'github');
    if (!connector) {
      throw new Error(`Connector not found: ${actionCtx.kind}`);
    }

    if (actionCtx.requestTier < connector.tier) {
      throw new Error(
        `TIER_VIOLATION: request tier ${actionCtx.requestTier} is more private than connector tier ${connector.tier}`
      );
    }

    const handlers = handlersByKind[actionCtx.kind];
    const handler = handlers?.[actionCtx.action];
    if (!handler) {
      throw new Error(`Unknown action ${actionCtx.kind}.${actionCtx.action}`);
    }

    const config = {
      tenantId: actionCtx.tenantId,
      kind: connector.kind,
      account: connector.account ?? null,
      secretRef: connector.secretRef ?? '',
    };

    let result: Record<string, unknown>;
    let success = true;
    try {
      result = await handler(ctx, config, actionCtx.input);
    } catch (error) {
      success = false;
      result = { error: error instanceof Error ? error.message : String(error) };
    }

    await createAuditEvent(ctx, {
      actor: actionCtx.actor,
      action: 'connector_action',
      tier: actionCtx.requestTier,
      payload: {
        kind: actionCtx.kind,
        action: actionCtx.action,
        input: actionCtx.input,
        success,
        result,
      },
    });

    if (!success) {
      throw new Error(`Connector action failed: ${JSON.stringify(result)}`);
    }

    return { success, result };
  }
}

export const connectorRegistry = new ConnectorRegistry();
