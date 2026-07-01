import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantContext } from '../../../db/tenant-context';
import {
  buildGoogleAuthorizationUrl,
  completeGoogleOAuth,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  verifyGoogleOAuthState,
} from './oauth';

const mocks = vi.hoisted(() => ({
  redis: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
  secrets: {
    setForTenant: vi.fn(),
  },
  createConnector: vi.fn(),
  findConnectorByKind: vi.fn(),
  updateConnector: vi.fn(),
  createAuditEvent: vi.fn(),
}));

vi.mock('../../../db/redis', () => ({
  redis: mocks.redis,
}));

vi.mock('../../../config/secrets', () => ({
  secrets: mocks.secrets,
}));

vi.mock('../../../repositories/connector', () => ({
  createConnector: mocks.createConnector,
  findConnectorByKind: mocks.findConnectorByKind,
  updateConnector: mocks.updateConnector,
}));

vi.mock('../../../repositories/audit', () => ({
  createAuditEvent: mocks.createAuditEvent,
}));

function mockFetch(response: {
  ok: boolean;
  status?: number;
  json?: () => unknown;
  text?: () => string;
}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: response.json ? response.json : async () => ({}),
    text: response.text ? response.text : async () => '',
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function mockFetchSequence(
  ...responses: Array<{
    ok: boolean;
    status?: number;
    json?: () => unknown;
    text?: () => string;
  }>
) {
  const fetchMock = vi.fn().mockImplementation(() => {
    const response = responses.shift();
    if (!response) {
      return Promise.reject(new Error('Unexpected fetch call'));
    }
    return Promise.resolve({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 400),
      json: response.json ? response.json : async () => ({}),
      text: response.text ? response.text : async () => '',
    });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('Google OAuth', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  beforeAll(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-client-secret');
    vi.stubEnv('GOOGLE_OAUTH_REDIRECT_URI', 'https://app.mimir.local/connectors/google/callback');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildGoogleAuthorizationUrl', () => {
    it('generates an authorization URL and stores state in Redis', async () => {
      vi.spyOn(crypto, 'randomUUID').mockImplementation(
        () => 'state-123' as `${string}-${string}-${string}-${string}-${string}`
      );

      const result = await buildGoogleAuthorizationUrl(tenantId, 'gmail');

      expect(result.state).toBe('state-123');
      expect(result.url).toContain('client_id=google-client-id');
      expect(result.url).toContain('response_type=code');
      expect(result.url).toContain(
        'scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly'
      );
      expect(result.url).toContain('access_type=offline');
      expect(result.url).toContain('prompt=consent');
      expect(result.url).toContain('state=state-123');
      expect(mocks.redis.set).toHaveBeenCalledWith(
        'oauth_state:state-123',
        JSON.stringify({
          tenantId,
          kind: 'gmail',
          redirectUri: 'https://app.mimir.local/connectors/google/callback',
          scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        }),
        'EX',
        600
      );
    });

    it.each(['gmail', 'googleContacts', 'googleDocs', 'googleSheets'] as const)(
      'uses the correct scopes for %s',
      async (kind) => {
        vi.spyOn(crypto, 'randomUUID').mockImplementation(
          () => 'state-456' as `${string}-${string}-${string}-${string}-${string}`
        );

        const result = await buildGoogleAuthorizationUrl(tenantId, kind);
        const expectedScope = {
          gmail: 'https://www.googleapis.com/auth/gmail.readonly',
          googleContacts: 'https://www.googleapis.com/auth/contacts.readonly',
          googleDocs: 'https://www.googleapis.com/auth/documents.readonly',
          googleSheets: 'https://www.googleapis.com/auth/spreadsheets.readonly',
        }[kind];
        expect(result.url).toContain(encodeURIComponent(expectedScope));
      }
    );
  });

  describe('verifyGoogleOAuthState', () => {
    it('returns parsed state and deletes the Redis key', async () => {
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({
          tenantId,
          kind: 'gmail',
          redirectUri: 'https://app.mimir.local/callback',
          scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        })
      );

      const result = await verifyGoogleOAuthState('state-123', 'gmail');

      expect(result).toEqual({
        tenantId,
        kind: 'gmail',
        redirectUri: 'https://app.mimir.local/callback',
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      });
      expect(mocks.redis.del).toHaveBeenCalledWith('oauth_state:state-123');
    });

    it('returns undefined when state is missing', async () => {
      mocks.redis.get.mockResolvedValue(null);

      const result = await verifyGoogleOAuthState('state-123', 'gmail');

      expect(result).toBeUndefined();
      expect(mocks.redis.del).not.toHaveBeenCalled();
    });

    it('returns undefined when stored kind does not match', async () => {
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({
          tenantId,
          kind: 'googleDocs',
          redirectUri: 'https://app.mimir.local/callback',
          scopes: [],
        })
      );

      const result = await verifyGoogleOAuthState('state-123', 'gmail');

      expect(result).toBeUndefined();
    });

    it('returns undefined when stored payload is invalid JSON', async () => {
      mocks.redis.get.mockResolvedValue('not-json');

      const result = await verifyGoogleOAuthState('state-123', 'gmail');

      expect(result).toBeUndefined();
    });
  });

  describe('exchangeGoogleCode', () => {
    it('exchanges the code for a token response', async () => {
      const tokenResponse = {
        access_token: 'access-123',
        refresh_token: 'refresh-123',
        expires_in: 3600,
        token_type: 'Bearer',
      };
      const fetchMock = mockFetch({ ok: true, json: () => tokenResponse });

      const result = await exchangeGoogleCode('code-123', 'https://app.mimir.local/callback');

      expect(result).toEqual(tokenResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.stringContaining('grant_type=authorization_code'),
        })
      );
      const body = fetchMock.mock.calls[0]?.[1]?.body as string;
      expect(body).toContain('code=code-123');
      expect(body).toContain('client_id=google-client-id');
      expect(body).toContain('client_secret=google-client-secret');
    });

    it('throws when the token exchange fails', async () => {
      mockFetch({ ok: false, text: () => 'invalid_grant' });

      await expect(
        exchangeGoogleCode('code-123', 'https://app.mimir.local/callback')
      ).rejects.toThrow('Google OAuth token exchange failed (400): invalid_grant');
    });
  });

  describe('fetchGoogleUserInfo', () => {
    it('returns the user email on success', async () => {
      mockFetch({ ok: true, json: () => ({ email: 'user@example.com' }) });

      const result = await fetchGoogleUserInfo('access-123');

      expect(result).toEqual({ email: 'user@example.com' });
    });

    it('returns an empty object when the request fails', async () => {
      mockFetch({ ok: false, status: 401 });

      const result = await fetchGoogleUserInfo('access-123');

      expect(result).toEqual({});
    });
  });

  describe('completeGoogleOAuth', () => {
    function ctx(): TenantContext {
      return new TenantContext(tenantId);
    }

    it('creates a new connector when none exists', async () => {
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({
          tenantId,
          kind: 'gmail',
          redirectUri: 'https://app.mimir.local/callback',
          scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        })
      );
      mockFetchSequence(
        { ok: true, json: () => ({ access_token: 'token-1', refresh_token: 'refresh-1' }) },
        { ok: true, json: () => ({ email: 'user@example.com' }) }
      );
      mocks.findConnectorByKind.mockResolvedValue(undefined);
      mocks.createConnector.mockResolvedValue({
        id: 'conn-1',
        kind: 'gmail',
        account: 'user@example.com',
        status: 'connected',
      });

      const result = await completeGoogleOAuth(ctx(), 'gmail', 'code-123', 'state-123');

      expect(mocks.secrets.setForTenant).toHaveBeenCalledWith(tenantId, 'gmail', 'token-1');
      expect(mocks.secrets.setForTenant).toHaveBeenCalledWith(
        tenantId,
        'gmail_refresh_token',
        'refresh-1'
      );
      expect(mocks.createConnector).toHaveBeenCalledWith(
        expect.any(TenantContext),
        expect.objectContaining({
          kind: 'gmail',
          account: 'user@example.com',
          secretRef: 'gmail',
          tier: 1,
          status: 'connected',
          scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
        })
      );
      expect(mocks.createAuditEvent).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'conn-1',
        kind: 'gmail',
        account: 'user@example.com',
        status: 'connected',
      });
    });

    it('updates an existing connector', async () => {
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({
          tenantId,
          kind: 'googleSheets',
          redirectUri: 'https://app.mimir.local/callback',
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        })
      );
      mockFetchSequence(
        { ok: true, json: () => ({ access_token: 'token-2' }) },
        { ok: true, json: () => ({ email: 'sheet-user@example.com' }) }
      );
      mocks.findConnectorByKind.mockResolvedValue({ id: 'conn-2' });
      mocks.updateConnector.mockResolvedValue({
        id: 'conn-2',
        kind: 'googleSheets',
        account: 'sheet-user@example.com',
        status: 'connected',
      });

      const result = await completeGoogleOAuth(ctx(), 'googleSheets', 'code-123', 'state-123');

      expect(mocks.updateConnector).toHaveBeenCalledWith(
        expect.any(TenantContext),
        'conn-2',
        expect.objectContaining({
          status: 'connected',
          account: 'sheet-user@example.com',
          secretRef: 'googleSheets',
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        })
      );
      expect(result.id).toBe('conn-2');
    });

    it('throws INVALID_OAUTH_STATE when state is missing', async () => {
      mocks.redis.get.mockResolvedValue(null);

      await expect(completeGoogleOAuth(ctx(), 'gmail', 'code-123', 'state-123')).rejects.toThrow(
        'INVALID_OAUTH_STATE'
      );
    });

    it('throws TENANT_MISMATCH when state belongs to another tenant', async () => {
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({
          tenantId: '22222222-2222-2222-2222-222222222222',
          kind: 'gmail',
          redirectUri: 'https://app.mimir.local/callback',
          scopes: [],
        })
      );

      await expect(completeGoogleOAuth(ctx(), 'gmail', 'code-123', 'state-123')).rejects.toThrow(
        'TENANT_MISMATCH'
      );
    });
  });
});
