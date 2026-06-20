import { describe, expect, it } from 'vitest';
import { withTenantTransaction } from '../db/tenant-context';
import { resolveAuthUser } from '../middleware/auth';
import { listAuditEvents } from '../repositories/audit';
import { createMessage, createSession } from '../repositories/session';
import { buildTestApp } from '../test-helpers/build-app';
import { sessionRoutes } from './sessions';

describe('sessions routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(sessionRoutes, { prefix: '/v1/sessions' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: { source: 'web' },
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('returns 201 with a valid bearer token', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(sessionRoutes, { prefix: '/v1/sessions' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { authorization: `Bearer sessions_user_${Date.now()}` },
      payload: { source: 'web' },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBeDefined();
    expect(body.tenantId).toBeDefined();
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'classifies a message and audits the classification decision',
    async () => {
      const token = `sessions_classification_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(sessionRoutes, { prefix: '/v1/sessions' });
      });

      const sessionResponse = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { source: 'web' },
      });
      expect(sessionResponse.statusCode).toBe(201);
      const session = JSON.parse(sessionResponse.body);

      const messageResponse = await app.inject({
        method: 'POST',
        url: `/v1/sessions/${session.id}/messages`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          role: 'user',
          content: 'My password is secret123 and my ssn is 123-45-6789',
        },
      });
      expect(messageResponse.statusCode).toBe(201);
      const message = JSON.parse(messageResponse.body);
      expect(message.tier).toBe(0);

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
      const token = `sessions_explicit_tier_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(sessionRoutes, { prefix: '/v1/sessions' });
      });

      const sessionResponse = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { source: 'web' },
      });
      const session = JSON.parse(sessionResponse.body);

      const messageResponse = await app.inject({
        method: 'POST',
        url: `/v1/sessions/${session.id}/messages`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'user', content: 'hello', tier: 2 },
      });
      expect(messageResponse.statusCode).toBe(201);
      const message = JSON.parse(messageResponse.body);
      expect(message.tier).toBe(2);

      const user = await resolveAuthUser(token, `${token}@test.local`);
      const audit = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listAuditEvents(ctx, { limit: 10 });
      });
      const decision = audit.data.find((e) => e.action === 'classification_decision');
      expect(decision).toBeDefined();
      expect(decision?.tier).toBe(2);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('returns session state with messages', async () => {
    const token = `sessions_state_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(sessionRoutes, { prefix: '/v1/sessions' });
    });

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { source: 'web' },
    });
    const session = JSON.parse(sessionResponse.body);

    await app.inject({
      method: 'POST',
      url: `/v1/sessions/${session.id}/messages`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'user', content: 'hello from device A' },
    });

    const stateResponse = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${session.id}/state`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(stateResponse.statusCode).toBe(200);
    const state = JSON.parse(stateResponse.body);
    expect(state.data.session.id).toBe(session.id);
    expect(state.data.messages).toHaveLength(1);
    expect(state.data.messages[0].content).toBe('hello from device A');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'resuming a session creates a child that shares the same conversation',
    async () => {
      const token = `sessions_resume_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(sessionRoutes, { prefix: '/v1/sessions' });
      });

      const sessionResponse = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { source: 'web' },
      });
      const parent = JSON.parse(sessionResponse.body);

      await app.inject({
        method: 'POST',
        url: `/v1/sessions/${parent.id}/messages`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'user', content: 'parent message' },
      });

      const resumeResponse = await app.inject({
        method: 'POST',
        url: `/v1/sessions/${parent.id}/resume`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(resumeResponse.statusCode).toBe(201);
      const { data: child } = JSON.parse(resumeResponse.body);
      expect(child.parentId).toBe(parent.id);

      await app.inject({
        method: 'POST',
        url: `/v1/sessions/${child.id}/messages`,
        headers: { authorization: `Bearer ${token}` },
        payload: { role: 'user', content: 'child message' },
      });

      const parentState = await app.inject({
        method: 'GET',
        url: `/v1/sessions/${parent.id}/state`,
        headers: { authorization: `Bearer ${token}` },
      });
      const parentBody = JSON.parse(parentState.body);
      expect(parentBody.data.messages).toHaveLength(2);
      expect(
        parentBody.data.messages.some((m: { content: string }) => m.content === 'child message')
      ).toBe(true);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('lists active sessions across devices', async () => {
    const token = `sessions_active_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(sessionRoutes, { prefix: '/v1/sessions' });
    });

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { source: 'web' },
    });
    const session = JSON.parse(sessionResponse.body);

    await app.inject({
      method: 'POST',
      url: `/v1/sessions/${session.id}/messages`,
      headers: { authorization: `Bearer ${token}` },
      payload: { role: 'user', content: 'active session message' },
    });

    const activeResponse = await app.inject({
      method: 'GET',
      url: '/v1/sessions/active',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(activeResponse.statusCode).toBe(200);
    const body = JSON.parse(activeResponse.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.some((s: { id: string }) => s.id === session.id)).toBe(true);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('searches messages across sessions', async () => {
    const externalId = `sessions_search_user_${Date.now()}`;
    const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

    const { session } = await withTenantTransaction(user.tenantId, async (ctx) => {
      const session = await createSession(ctx, { source: 'web' });
      await createMessage(ctx, {
        sessionId: session.id,
        role: 'user',
        content: 'I am planning a trip to Berlin in October.',
      });
      return { session };
    });

    const app = await buildTestApp(async (app) => {
      await app.register(sessionRoutes, { prefix: '/v1/sessions' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions/search?query=Berlin',
      headers: { authorization: `Bearer ${externalId}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.results).toBeInstanceOf(Array);
    expect(body.results.length).toBeGreaterThan(0);
    expect(
      body.results.some((r: { message: { content: string } }) =>
        r.message.content.includes('Berlin')
      )
    ).toBe(true);
    expect(body.results.some((r: { session: { id: string } }) => r.session.id === session.id)).toBe(
      true
    );
  });
});
