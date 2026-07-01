import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantContext } from '../../../db/tenant-context';
import {
  buildNotionAuthorizationUrl,
  completeNotionOAuth,
  exchangeNotionCode,
  verifyNotionOAuthState,
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

describe('Notion OAuth', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  beforeAll(() => {
    vi.stubEnv('NOTION_CLIENT_ID', 'notion-client-id');
    vi.stubEnv('NOTION_CLIENT_SECRET', 'notion-client-secret');
    vi.stubEnv('NOTION_OAUTH_REDIRECT_URI', 'https://app.mimir.local/connectors/notion/callback');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildNotionAuthorizationUrl', () => {
    it('generates an authorization URL and stores state in Redis', async () => {
      vi.spyOn(crypto, 'randomUUID').mockImplementation(
        () => 'state-123' as `${string}-${string}-${string}-${string}-${string}`
      );

      const result = await buildNotionAuthorizationUrl(tenantId);

      expect(result.state).toBe('state-123');
      expect(result.url).toContain('client_id=notion-client-id');
      expect(result.url).toContain('response_type=code');
      expect(result.url).toContain('state=state-123');
      expect(mocks.redis.set).toHaveBeenCalledWith(
        'oauth_state:state-123',
        JSON.stringify({
          tenantId,
          kind: 'notion',
          redirectUri: 'https://app.mimir.local/connectors/notion/callback',
        }),
        'EX',
        600
      );
    });
  });

  describe('verifyNotionOAuthState', () => {
    it('returns parsed state and deletes the Redis key', async () => {
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({
          tenantId,
          kind: 'notion',
          redirectUri: 'https://app.mimir.local/connectors/notion/callback',
        })
      );

      const result = await verifyNotionOAuthState('state-123');

      expect(result).toEqual({
        tenantId,
        kind: 'notion',
        redirectUri: 'https://app.mimir.local/connectors/notion/callback',
      });
      expect(mocks.redis.del).toHaveBeenCalledWith('oauth_state:state-123');
    });

    it('returns undefined when state is missing', async () => {
      mocks.redis.get.mockResolvedValue(null);

      const result = await verifyNotionOAuthState('state-123');

      expect(result).toBeUndefined();
      expect(mocks.redis.del).not.toHaveBeenCalled();
    });

    it('returns undefined when stored kind is not notion', async () => {
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({ tenantId, kind: 'airtable', redirectUri: '' })
      );

      const result = await verifyNotionOAuthState('state-123');

      expect(result).toBeUndefined();
    });

    it('returns undefined when stored payload is invalid JSON', async () => {
      mocks.redis.get.mockResolvedValue('not-json');

      const result = await verifyNotionOAuthState('state-123');

      expect(result).toBeUndefined();
    });
  });

  describe('exchangeNotionCode', () => {
    it('exchanges the code for a token response', async () => {
      const tokenResponse = {
        access_token: 'access-123',
        token_type: 'Bearer',
        bot_id: 'bot-1',
        workspace_name: 'Acme',
        workspace_id: 'ws-1',
      };
      const fetchMock = mockFetch({ ok: true, json: () => tokenResponse });

      const result = await exchangeNotionCode('code-123', 'https://app.mimir.local/callback');

      expect(result).toEqual(tokenResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.notion.com/v1/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Basic ${Buffer.from('notion-client-id:notion-client-secret').toString('base64')}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code: 'code-123',
            redirect_uri: 'https://app.mimir.local/callback',
          }),
        })
      );
    });

    it('throws when the token exchange fails', async () => {
      mockFetch({ ok: false, text: () => 'invalid_code' });

      await expect(
        exchangeNotionCode('code-123', 'https://app.mimir.local/callback')
      ).rejects.toThrow('Notion OAuth token exchange failed (400): invalid_code');
    });
  });

  describe('completeNotionOAuth', () => {
    function ctx(): TenantContext {
      return new TenantContext(tenantId);
    }

    it('creates a new connector when none exists', async () => {
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({
          tenantId,
          kind: 'notion',
          redirectUri: 'https://app.mimir.local/callback',
        })
      );
      mockFetch({
        ok: true,
        json: () => ({
          access_token: 'token-1',
          token_type: 'Bearer',
          bot_id: 'bot-1',
          workspace_name: 'Acme Workspace',
          workspace_id: 'ws-1',
        }),
      });
      mocks.findConnectorByKind.mockResolvedValue(undefined);
      mocks.createConnector.mockResolvedValue({
        id: 'conn-1',
        kind: 'notion',
        account: 'Acme Workspace',
        status: 'connected',
      });

      const result = await completeNotionOAuth(ctx(), 'code-123', 'state-123');

      expect(mocks.secrets.setForTenant).toHaveBeenCalledWith(tenantId, 'notion', 'token-1');
      expect(mocks.createConnector).toHaveBeenCalledWith(
        expect.any(TenantContext),
        expect.objectContaining({
          kind: 'notion',
          account: 'Acme Workspace',
          secretRef: 'notion',
          tier: 1,
          status: 'connected',
        })
      );
      expect(mocks.createAuditEvent).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'conn-1',
        kind: 'notion',
        account: 'Acme Workspace',
        status: 'connected',
      });
    });

    it('updates an existing connector', async () => {
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({
          tenantId,
          kind: 'notion',
          redirectUri: 'https://app.mimir.local/callback',
        })
      );
      mockFetch({
        ok: true,
        json: () => ({
          access_token: 'token-2',
          token_type: 'Bearer',
          bot_id: 'bot-2',
          workspace_name: 'Updated Workspace',
          workspace_id: 'ws-2',
        }),
      });
      mocks.findConnectorByKind.mockResolvedValue({ id: 'conn-2' });
      mocks.updateConnector.mockResolvedValue({
        id: 'conn-2',
        kind: 'notion',
        account: 'Updated Workspace',
        status: 'connected',
      });

      const result = await completeNotionOAuth(ctx(), 'code-123', 'state-123');

      expect(mocks.updateConnector).toHaveBeenCalledWith(
        expect.any(TenantContext),
        'conn-2',
        expect.objectContaining({
          status: 'connected',
          account: 'Updated Workspace',
          secretRef: 'notion',
        })
      );
      expect(result.id).toBe('conn-2');
    });

    it('throws INVALID_OAUTH_STATE when state is missing', async () => {
      mocks.redis.get.mockResolvedValue(null);

      await expect(completeNotionOAuth(ctx(), 'code-123', 'state-123')).rejects.toThrow(
        'INVALID_OAUTH_STATE'
      );
    });

    it('throws TENANT_MISMATCH when state belongs to another tenant', async () => {
      mocks.redis.get.mockResolvedValue(
        JSON.stringify({
          tenantId: '22222222-2222-2222-2222-222222222222',
          kind: 'notion',
          redirectUri: 'https://app.mimir.local/callback',
        })
      );

      await expect(completeNotionOAuth(ctx(), 'code-123', 'state-123')).rejects.toThrow(
        'TENANT_MISMATCH'
      );
    });
  });
});
