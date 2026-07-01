import { secrets } from '../../../config/secrets';
import { redis } from '../../../db/redis';
import type { TenantContext } from '../../../db/tenant-context';
import { createAuditEvent } from '../../../repositories/audit';
import {
  createConnector,
  findConnectorByKind,
  updateConnector,
} from '../../../repositories/connector';

const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 minutes
const NOTION_AUTHORIZE_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

export interface NotionOAuthState {
  tenantId: string;
  kind: 'notion';
  redirectUri: string;
}

export interface NotionOAuthInit {
  url: string;
  state: string;
}

export interface NotionTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_name: string;
  workspace_icon?: string;
  workspace_id: string;
  owner?: Record<string, unknown>;
  duplicated_template_id?: string;
}

export interface NotionOAuthResult {
  workspaceName: string;
  accessToken: string;
}

function requireConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Notion OAuth is not configured; set NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, and NOTION_OAUTH_REDIRECT_URI'
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function stateKey(state: string): string {
  return `oauth_state:${state}`;
}

export async function buildNotionAuthorizationUrl(tenantId: string): Promise<NotionOAuthInit> {
  const { clientId, redirectUri } = requireConfig();
  const state = crypto.randomUUID();

  const payload: NotionOAuthState = {
    tenantId,
    kind: 'notion',
    redirectUri,
  };

  await redis.set(stateKey(state), JSON.stringify(payload), 'EX', OAUTH_STATE_TTL_SECONDS);

  const url = new URL(NOTION_AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('owner', 'user');
  url.searchParams.set('state', state);

  return { url: url.toString(), state };
}

export async function verifyNotionOAuthState(state: string): Promise<NotionOAuthState | undefined> {
  const raw = await redis.get(stateKey(state));
  if (!raw) return undefined;
  await redis.del(stateKey(state));

  try {
    const parsed = JSON.parse(raw) as NotionOAuthState;
    if (parsed.kind !== 'notion') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export async function exchangeNotionCode(
  code: string,
  redirectUri: string
): Promise<NotionTokenResponse> {
  const { clientId, clientSecret } = requireConfig();

  const response = await fetch(NOTION_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion OAuth token exchange failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<NotionTokenResponse>;
}

export async function completeNotionOAuth(
  ctx: TenantContext,
  code: string,
  state: string
): Promise<{ id: string; kind: 'notion'; account: string | null; status: string }> {
  const stored = await verifyNotionOAuthState(state);
  if (!stored) {
    throw new Error('INVALID_OAUTH_STATE');
  }
  if (stored.tenantId !== ctx.tenantId) {
    throw new Error('TENANT_MISMATCH');
  }

  const tokenData = await exchangeNotionCode(code, stored.redirectUri);
  const accessToken = tokenData.access_token;
  const workspaceName = tokenData.workspace_name ?? 'Notion workspace';

  await secrets.setForTenant(ctx.tenantId, 'notion', accessToken);

  const existing = await findConnectorByKind(ctx, 'notion');
  let connector: Awaited<ReturnType<typeof createConnector>> | undefined;
  if (existing) {
    connector = await updateConnector(ctx, existing.id, {
      status: 'connected',
      account: workspaceName,
      secretRef: 'notion',
    });
  } else {
    connector = await createConnector(ctx, {
      kind: 'notion',
      account: workspaceName,
      secretRef: 'notion',
      tier: 1,
      status: 'connected',
    });
  }

  if (!connector) {
    throw new Error('Failed to persist Notion connector');
  }

  await createAuditEvent(ctx, {
    actor: 'system',
    action: 'connector_connected',
    tier: 1,
    payload: {
      kind: 'notion',
      connectorId: connector.id,
      workspaceId: tokenData.workspace_id,
      workspaceName,
    } as Record<string, unknown>,
  });

  return {
    id: connector.id,
    kind: connector.kind as 'notion',
    account: connector.account,
    status: connector.status,
  };
}
