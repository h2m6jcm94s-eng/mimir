import { GitHubOpenPrInput } from '@mimir/shared-types';
import { secrets } from '../../../config/secrets';
import type { ConnectorApplyFn, ConnectorWriteDescriptor } from '../write-registry';
import { connectorWriteRegistry } from '../write-registry';
import { GitHubClient } from './client';

const githubOpenPrApply: ConnectorApplyFn = async (_ctx, config, input) => {
  const payload = input as {
    owner: string;
    repo: string;
    title: string;
    body: string;
    head: string;
    base: string;
  };

  const client = new GitHubClient(
    {
      tenantId: config.tenantId,
      account: config.account,
      secretRef: config.secretRef,
    },
    secrets
  );

  const pr = (await client.openPr(payload)) as {
    number: number;
    html_url: string;
  };

  return {
    applied: true,
    reason: `Opened PR #${pr.number}`,
    output: { number: pr.number, url: pr.html_url },
  };
};

const githubOpenPrDescriptor: ConnectorWriteDescriptor = {
  kind: 'github',
  action: 'openPr',
  inputSchema: GitHubOpenPrInput as unknown as import('zod').ZodType<unknown>,
  preview: (input) => {
    const payload = input as { title?: string; body?: string };
    return [payload.title ?? '', payload.body ?? ''].join(' ').trim();
  },
  approvalMessage: (input) => {
    const payload = input as {
      title: string;
      owner: string;
      repo: string;
      head: string;
      base: string;
    };
    return {
      title: 'Open pull request',
      description: `Open PR "${payload.title}" in ${payload.owner}/${payload.repo} (${payload.head} → ${payload.base})`,
    };
  },
  apply: githubOpenPrApply,
};

connectorWriteRegistry.register(githubOpenPrDescriptor);

export const githubOpenPrHandler = connectorWriteRegistry.applyHandlerFor(githubOpenPrDescriptor);
