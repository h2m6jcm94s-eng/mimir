import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { buildTestApp } from '../test-helpers/build-app';
import { knowledgeRoutes } from './knowledge';
import { knowledgeShareRoutes } from './knowledge-shares';

async function getTenantIdForToken(token: string): Promise<string> {
  const identity = await db.query.externalIdentity.findFirst({
    where: eq(schema.externalIdentity.externalId, token),
  });
  if (!identity?.defaultTenantId) {
    throw new Error(`No tenant resolved for token ${token}`);
  }
  return identity.defaultTenantId;
}

describe('knowledge share routes', () => {
  it('returns 401 without authorization', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(knowledgeShareRoutes, { prefix: '/v1/knowledge/shares' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/knowledge/shares',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'requester can request a share and provider can approve it',
    async () => {
      const providerToken = `share_provider_${Date.now()}`;
      const requesterToken = `share_requester_${Date.now()}`;
      const keyword = 'crossmesh';

      const app = await buildTestApp(async (app) => {
        await app.register(knowledgeShareRoutes, { prefix: '/v1/knowledge/shares' });
        await app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
      });

      // Provider ingests a document.
      const ingestResponse = await app.inject({
        method: 'POST',
        url: '/v1/knowledge',
        headers: { authorization: `Bearer ${providerToken}` },
        payload: {
          kind: 'doc',
          uri: 'file:///crossmesh.txt',
          content: `This document describes the ${keyword} topology for inter-team knowledge exchange.`,
          tier: 1,
        },
      });
      expect(ingestResponse.statusCode).toBe(201);
      const { itemId } = JSON.parse(ingestResponse.body);
      expect(itemId).toBeDefined();

      const providerTenantId = await getTenantIdForToken(providerToken);

      // Requester creates a share request.
      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/knowledge/shares',
        headers: { authorization: `Bearer ${requesterToken}` },
        payload: {
          providerTenantId,
          knowledgeItemId: itemId,
          scope: 'search',
        },
      });
      expect(createResponse.statusCode).toBe(201);
      const created = JSON.parse(createResponse.body);
      expect(created.status).toBe('pending');
      expect(created.providerTenantId).toBe(providerTenantId);
      expect(created.knowledgeItemId).toBe(itemId);

      // Requester sees the outgoing request.
      const outgoingResponse = await app.inject({
        method: 'GET',
        url: '/v1/knowledge/shares?direction=outgoing',
        headers: { authorization: `Bearer ${requesterToken}` },
      });
      expect(outgoingResponse.statusCode).toBe(200);
      const outgoing = JSON.parse(outgoingResponse.body);
      expect(outgoing.data.some((s: { id: string }) => s.id === created.id)).toBe(true);

      // Provider sees the incoming request.
      const incomingResponse = await app.inject({
        method: 'GET',
        url: '/v1/knowledge/shares?direction=incoming',
        headers: { authorization: `Bearer ${providerToken}` },
      });
      expect(incomingResponse.statusCode).toBe(200);
      const incoming = JSON.parse(incomingResponse.body);
      expect(incoming.data.some((s: { id: string }) => s.id === created.id)).toBe(true);

      // Requester cannot approve their own request.
      const requesterApproveResponse = await app.inject({
        method: 'POST',
        url: `/v1/knowledge/shares/${created.id}/approve`,
        headers: { authorization: `Bearer ${requesterToken}` },
      });
      expect(requesterApproveResponse.statusCode).toBe(400);

      // Provider approves.
      const approveResponse = await app.inject({
        method: 'POST',
        url: `/v1/knowledge/shares/${created.id}/approve`,
        headers: { authorization: `Bearer ${providerToken}` },
      });
      expect(approveResponse.statusCode).toBe(200);
      const approved = JSON.parse(approveResponse.body);
      expect(approved.status).toBe('approved');

      // Requester can search the shared knowledge when includeShared=true.
      const searchSharedResponse = await app.inject({
        method: 'GET',
        url: `/v1/knowledge/search?q=${keyword}&includeShared=true`,
        headers: { authorization: `Bearer ${requesterToken}` },
      });
      expect(searchSharedResponse.statusCode).toBe(200);
      const sharedResults = JSON.parse(searchSharedResponse.body);
      expect(sharedResults.data.length).toBeGreaterThan(0);
      expect(sharedResults.data[0].text).toContain(keyword);
      expect(sharedResults.data[0].sharedFromTenantId).toBe(providerTenantId);

      // Without includeShared, the foreign item is not visible.
      const searchLocalResponse = await app.inject({
        method: 'GET',
        url: `/v1/knowledge/search?q=${keyword}`,
        headers: { authorization: `Bearer ${requesterToken}` },
      });
      expect(searchLocalResponse.statusCode).toBe(200);
      const localResults = JSON.parse(searchLocalResponse.body);
      expect(
        localResults.data.some((r: { sharedFromTenantId?: string }) => r.sharedFromTenantId)
      ).toBe(false);

      // Provider revokes the share.
      const revokeResponse = await app.inject({
        method: 'POST',
        url: `/v1/knowledge/shares/${created.id}/revoke`,
        headers: { authorization: `Bearer ${providerToken}` },
      });
      expect(revokeResponse.statusCode).toBe(200);
      const revoked = JSON.parse(revokeResponse.body);
      expect(revoked.status).toBe('revoked');

      // Shared copy is no longer searchable.
      const afterRevokeResponse = await app.inject({
        method: 'GET',
        url: `/v1/knowledge/search?q=${keyword}&includeShared=true`,
        headers: { authorization: `Bearer ${requesterToken}` },
      });
      expect(afterRevokeResponse.statusCode).toBe(200);
      const afterRevoke = JSON.parse(afterRevokeResponse.body);
      expect(
        afterRevoke.data.some((r: { sharedFromTenantId?: string }) => r.sharedFromTenantId)
      ).toBe(false);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('denied share does not copy knowledge', async () => {
    const providerToken = `deny_provider_${Date.now()}`;
    const requesterToken = `deny_requester_${Date.now()}`;
    const keyword = 'deniedmesh';

    const app = await buildTestApp(async (app) => {
      await app.register(knowledgeShareRoutes, { prefix: '/v1/knowledge/shares' });
      await app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
    });

    const ingestResponse = await app.inject({
      method: 'POST',
      url: '/v1/knowledge',
      headers: { authorization: `Bearer ${providerToken}` },
      payload: {
        kind: 'doc',
        content: `This document is about ${keyword} and should never be shared.`,
      },
    });
    expect(ingestResponse.statusCode).toBe(201);
    const { itemId } = JSON.parse(ingestResponse.body);

    const providerTenantId = await getTenantIdForToken(providerToken);

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/knowledge/shares',
      headers: { authorization: `Bearer ${requesterToken}` },
      payload: { providerTenantId, knowledgeItemId: itemId },
    });
    const created = JSON.parse(createResponse.body);

    const denyResponse = await app.inject({
      method: 'POST',
      url: `/v1/knowledge/shares/${created.id}/deny`,
      headers: { authorization: `Bearer ${providerToken}` },
    });
    expect(denyResponse.statusCode).toBe(200);
    const denied = JSON.parse(denyResponse.body);
    expect(denied.status).toBe('denied');

    const searchResponse = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/search?q=${keyword}&includeShared=true`,
      headers: { authorization: `Bearer ${requesterToken}` },
    });
    expect(searchResponse.statusCode).toBe(200);
    const results = JSON.parse(searchResponse.body);
    expect(results.data.length).toBe(0);
  });
});
