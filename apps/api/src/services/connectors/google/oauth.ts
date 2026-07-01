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
const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export const GOOGLE_CONNECTOR_KINDS = [
  'gmail',
  'googleContacts',
  'googleDocs',
  'googleSheets',
] as const;

export type GoogleConnectorKind = (typeof GOOGLE_CONNECTOR_KINDS)[number];

const GOOGLE_OAUTH_SCOPES: Record<GoogleConnectorKind, string[]> = {
  gmail: ['https://www.googleapis.com/auth/gmail.readonly'],
  googleContacts: ['https://www.googleapis.com/auth/contacts.readonly'],
  googleDocs: ['https://www.googleapis.com/auth/documents.readonly'],
  googleSheets: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
};

export interface GoogleOAuthState {
  tenantId: string;
  kind: GoogleConnectorKind;
  redirectUri: string;
  scopes: string[];
}

export interface GoogleOAuthInit {
  url: string;
  state: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

function requireConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Google OAuth is not configured; set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI'
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function stateKey(state: string): string {
  return `oauth_state:${state}`;
}

export function isGoogleConnectorKind(kind: string): kind is GoogleConnectorKind {
  return (GOOGLE_CONNECTOR_KINDS as readonly string[]).includes(kind);
}

export function scopesForGoogleConnector(kind: GoogleConnectorKind): string[] {
  return GOOGLE_OAUTH_SCOPES[kind];
}

export async function buildGoogleAuthorizationUrl(
  tenantId: string,
  kind: GoogleConnectorKind
): Promise<GoogleOAuthInit> {
  const { clientId, redirectUri } = requireConfig();
  const state = crypto.randomUUID();
  const scopes = scopesForGoogleConnector(kind);

  const payload: GoogleOAuthState = {
    tenantId,
    kind,
    redirectUri,
    scopes,
  };

  await redis.set(stateKey(state), JSON.stringify(payload), 'EX', OAUTH_STATE_TTL_SECONDS);

  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  return { url: url.toString(), state };
}

export async function verifyGoogleOAuthState(
  state: string,
  expectedKind: GoogleConnectorKind
): Promise<GoogleOAuthState | undefined> {
  const raw = await redis.get(stateKey(state));
  if (!raw) return undefined;
  await redis.del(stateKey(state));

  try {
    const parsed = JSON.parse(raw) as GoogleOAuthState;
    if (!isGoogleConnectorKind(parsed.kind) || parsed.kind !== expectedKind) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireConfig();

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google OAuth token exchange failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<{ email?: string }> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return {};
  }

  return response.json() as Promise<{ email?: string }>;
}

export async function completeGoogleOAuth(
  ctx: TenantContext,
  kind: GoogleConnectorKind,
  code: string,
  state: string
): Promise<{ id: string; kind: GoogleConnectorKind; account: string | null; status: string }> {
  const stored = await verifyGoogleOAuthState(state, kind);
  if (!stored) {
    throw new Error('INVALID_OAUTH_STATE');
  }
  if (stored.tenantId !== ctx.tenantId) {
    throw new Error('TENANT_MISMATCH');
  }

  const tokenData = await exchangeGoogleCode(code, stored.redirectUri);
  const accessToken = tokenData.access_token;

  await secrets.setForTenant(ctx.tenantId, kind, accessToken);
  if (tokenData.refresh_token) {
    await secrets.setForTenant(ctx.tenantId, `${kind}_refresh_token`, tokenData.refresh_token);
  }

  const userInfo = await fetchGoogleUserInfo(accessToken);
  const account = userInfo.email ?? null;

  const existing = await findConnectorByKind(ctx, kind);
  let connector: Awaited<ReturnType<typeof createConnector>> | undefined;
  if (existing) {
    connector = await updateConnector(ctx, existing.id, {
      status: 'connected',
      account,
      secretRef: kind,
      scopes: stored.scopes,
    });
  } else {
    connector = await createConnector(ctx, {
      kind,
      account,
      secretRef: kind,
      tier: 1,
      status: 'connected',
      scopes: stored.scopes,
    });
  }

  if (!connector) {
    throw new Error('Failed to persist Google connector');
  }

  await createAuditEvent(ctx, {
    actor: 'system',
    action: 'connector_connected',
    tier: 1,
    payload: {
      kind,
      connectorId: connector.id,
      account,
      scopes: stored.scopes,
    } as Record<string, unknown>,
  });

  return {
    id: connector.id,
    kind,
    account: connector.account,
    status: connector.status,
  };
}
