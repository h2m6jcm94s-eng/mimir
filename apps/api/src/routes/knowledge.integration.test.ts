import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { listAuditEvents } from '../repositories/audit';
import { buildTestApp } from '../test-helpers/build-app';
import { captureRoutes } from './capture';
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

  it.skipIf(!process.env.RUN_DB_TESTS)('rejects a screenshot without a citation uri', async () => {
    const token = `knowledge_screenshot_no_uri_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/knowledge',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        kind: 'screenshot',
        content: 'OCR text from a screenshot',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error?.message).toMatch(/screenshots require a citation uri/i);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'ingests a screenshot with ocr text and returns its citation on search',
    async () => {
      const token = `knowledge_screenshot_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
      });

      const ingestResponse = await app.inject({
        method: 'POST',
        url: '/v1/knowledge',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          kind: 'screenshot',
          uri: 'https://example.com/invoice/9921',
          content: 'Invoice total is $142.50 for invoice number 9921.',
          tier: 2,
        },
      });

      expect(ingestResponse.statusCode).toBe(201);
      const ingestBody = JSON.parse(ingestResponse.body);
      expect(ingestBody.itemId).toBeDefined();
      expect(ingestBody.tier).toBe(2);

      const searchResponse = await app.inject({
        method: 'GET',
        url: '/v1/knowledge/search?q=invoice&limit=5',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(searchResponse.statusCode).toBe(200);
      const searchBody = JSON.parse(searchResponse.body);
      expect(searchBody.data.length).toBeGreaterThan(0);
      const hit = searchBody.data.find((r: { kind: string }) => r.kind === 'screenshot');
      expect(hit).toBeDefined();
      expect(hit.citation).toBe('https://example.com/invoice/9921');
      expect(hit.uri).toBe('https://example.com/invoice/9921');
    }
  );

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

  it.skipIf(!process.env.RUN_DB_TESTS)('creates and lists notes', async () => {
    const token = `knowledge_notes_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/v1/knowledge/notes',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: 'Idea: memory graph',
        content: 'Build a graph of linked ideas so Mimir can traverse memory.',
        tags: ['idea', 'memory'],
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const createBody = JSON.parse(createResponse.body);
    expect(createBody.itemId).toBeDefined();
    expect(createBody.chunks).toBeGreaterThan(0);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/v1/knowledge/notes',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.data.length).toBeGreaterThan(0);
    expect(listBody.data[0].meta.title).toBe('Idea: memory graph');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'captures a note with [[link]] syntax and returns related notes',
    async () => {
      const token = `knowledge_capture_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
        await app.register(captureRoutes, { prefix: '/v1/capture' });
      });

      const captureResponse = await app.inject({
        method: 'POST',
        url: '/v1/capture',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          content: 'Meeting notes: discuss the [[Q3 roadmap]] with the team.',
          tags: ['meeting'],
        },
      });

      expect(captureResponse.statusCode).toBe(201);
      const captureBody = JSON.parse(captureResponse.body);
      expect(captureBody.itemId).toBeDefined();
      expect(captureBody.links.length).toBe(1);
      expect(captureBody.links[0].title).toBe('Q3 roadmap');

      const relatedResponse = await app.inject({
        method: 'GET',
        url: `/v1/capture/${captureBody.itemId}/related`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(relatedResponse.statusCode).toBe(200);
      const relatedBody = JSON.parse(relatedResponse.body);
      expect(relatedBody.outbound.length).toBe(1);
      expect(relatedBody.outbound[0].meta.title).toBe('Q3 roadmap');
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('links knowledge items and returns a graph', async () => {
    const token = `knowledge_links_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(knowledgeRoutes, { prefix: '/v1/knowledge' });
    });

    const noteA = await app.inject({
      method: 'POST',
      url: '/v1/knowledge/notes',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Note A', content: 'First idea.' },
    });
    const noteB = await app.inject({
      method: 'POST',
      url: '/v1/knowledge/notes',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Note B', content: 'Second idea.' },
    });

    const aId = JSON.parse(noteA.body).itemId;
    const bId = JSON.parse(noteB.body).itemId;

    const linkResponse = await app.inject({
      method: 'POST',
      url: `/v1/knowledge/items/${aId}/links`,
      headers: { authorization: `Bearer ${token}` },
      payload: { targetId: bId, kind: 'relates_to' },
    });

    expect(linkResponse.statusCode).toBe(201);
    const linkBody = JSON.parse(linkResponse.body);
    expect(linkBody.link.targetId).toBe(bId);

    const linksResponse = await app.inject({
      method: 'GET',
      url: `/v1/knowledge/items/${aId}/links`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(linksResponse.statusCode).toBe(200);
    const linksBody = JSON.parse(linksResponse.body);
    expect(linksBody.outbound.length).toBe(1);
    expect(linksBody.outbound[0].targetId).toBe(bId);

    const graphResponse = await app.inject({
      method: 'GET',
      url: '/v1/knowledge/graph',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(graphResponse.statusCode).toBe(200);
    const graphBody = JSON.parse(graphResponse.body);
    expect(graphBody.nodes.length).toBeGreaterThanOrEqual(2);
    expect(graphBody.edges.length).toBeGreaterThanOrEqual(1);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/v1/knowledge/items/${aId}/links/${linkBody.link.id}`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(deleteResponse.statusCode).toBe(204);
  });
});
