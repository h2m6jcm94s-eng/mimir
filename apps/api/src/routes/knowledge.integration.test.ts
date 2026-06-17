import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { listAuditEvents } from '../repositories/audit';
import { buildTestApp } from '../test-helpers/build-app';
import { knowledgeRoutes } from './knowledge';

describe('knowledge routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge',
      payload: { kind: 'doc', content: 'hello world' },
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('ingests a document and searches by keyword', async () => {
    const token = `knowledge_user_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
    });

    const ingestResponse = await app.inject({
      method: 'POST',
      url: '/v1/knowledge',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'doc',
        uri: 'file:///test.txt',
        content:
          'PostgreSQL is a powerful, open source object-relational database system. ' +
          'It has more than 35 years of active development and a proven architecture.',
      },
    });

    expect(ingestResponse.statusCode).toBe(201);
    const ingestBody = JSON.parse(ingestResponse.body);
    expect(ingestBody.itemId).toBeDefined();
    expect(ingestBody.chunks).toBeGreaterThan(0);

    const searchResponse = await app.inject({
      method: 'GET',
      url: '/v1/knowledge/search?q=PostgreSQL&limit=5',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(searchResponse.statusCode).toBe(200);
    const searchBody = JSON.parse(searchResponse.body);
    expect(searchBody.data.length).toBeGreaterThan(0);
    expect(searchBody.data[0]?.text).toContain('PostgreSQL');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'classifies an untagged document and audits the classification decision',
    async () => {
      const token = `knowledge_classification_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
      });

      const ingestResponse = await app.inject({
        method: 'POST',
        url: '/v1/knowledge',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          kind: 'doc',
          content:
            'This document is internal only and confidential. Do not share outside the company.',
        },
      });

      expect(ingestResponse.statusCode).toBe(201);
      const ingestBody = JSON.parse(ingestResponse.body);
      expect(ingestBody.tier).toBe(0);

      const user = await resolveAuthUser(token, `${token}@test.local`);
      const audit = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listAuditEvents(ctx, { limit: 10 });
      });
      const decision = audit.data.find((e) => e.action === 'classification_decision');
      expect(decision).toBeDefined();
      expect(decision?.tier).toBe(0);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'accepts an explicit tier and audits it as a classification decision',
    async () => {
      const token = `knowledge_explicit_tier_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
      });

      const ingestResponse = await app.inject({
        method: 'POST',
        url: '/v1/knowledge',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          kind: 'doc',
          content: 'Public Wikipedia article about the weather.',
          tier: 2,
        },
      });

      expect(ingestResponse.statusCode).toBe(201);
      const ingestBody = JSON.parse(ingestResponse.body);
      expect(ingestBody.tier).toBe(2);

      const user = await resolveAuthUser(token, `${token}@test.local`);
      const audit = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listAuditEvents(ctx, { limit: 10 });
      });
      const decision = audit.data.find((e) => e.action === 'classification_decision');
      expect(decision).toBeDefined();
      expect(decision?.tier).toBe(2);
    }
  );
});
