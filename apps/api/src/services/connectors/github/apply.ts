import { secrets } from '../../../config/secrets';
import type { TenantContext } from '../../../db/tenant-context';
import { findConnectorByKind } from '../../../repositories/connector';
import type { ApplyHandler } from '../../apply/registry';
import { GitHubClient } from './client';

export const githubOpenPrHandler: ApplyHandler = async (ctx, input, _draft, review) => {
  if (!review.approved) {
    return {
      applied: false,
      reason: 'Review did not approve the PR',
      output: {},
    };
  }

  const connector = await findConnectorByKind(ctx, 'github');
  if (!connector) {
    return {
      applied: false,
      reason: 'GitHub connector not configured',
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

  const payload = input.payload as {
    owner: string;
    repo: string;
    title: string;
    body: string;
    head: string;
    base: string;
  };

  const client = new GitHubClient(
    {
      tenantId: input.tenantId,
      account: connector.account ?? null,
      secretRef: connector.secretRef ?? '',
    },
    secrets
  );

  try {
    const pr = (await client.openPr(payload)) as {
      number: number;
      html_url: string;
    };
    return {
      applied: true,
      reason: `Opened PR #${pr.number}`,
      output: { number: pr.number, url: pr.html_url },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      applied: false,
      reason: message,
      output: {},
    };
  }
};
