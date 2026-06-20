import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { resetEmailTransporter } from '../services/email-digest/transport';
import { buildTestApp } from '../test-helpers/build-app';
import { emailDigestRoutes } from './email-digest';

describe('email digest routes', () => {
  it('returns 401 without authorization', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(emailDigestRoutes, { prefix: '/v1/email-digest' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/email-digest/me',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'creates, updates, and returns digest preferences',
    async () => {
      const externalId = `email_digest_user_${Date.now()}`;
      const user = await resolveAuthUser(externalId, `${externalId}@test.local`);

      const app = await buildTestApp(async (app) => {
        await app.register(emailDigestRoutes, { prefix: '/v1/email-digest' });
      });

      const getResponse = await app.inject({
        method: 'GET',
        url: '/v1/email-digest/me',
        headers: { authorization: `Bearer ${externalId}` },
      });
      expect(getResponse.statusCode).toBe(200);
      const getBody = JSON.parse(getResponse.body);
      expect(getBody.data.enabled).toBe(true);
      expect(getBody.data.frequency).toBe('daily');

      const putResponse = await app.inject({
        method: 'PUT',
        url: '/v1/email-digest/me',
        headers: { authorization: `Bearer ${externalId}`, 'content-type': 'application/json' },
        payload: JSON.stringify({
          frequency: 'weekly',
          enabled: false,
          includeNotifications: false,
          includeTasks: true,
          includeApprovals: true,
          includeReports: false,
        }),
      });
      expect(putResponse.statusCode).toBe(200);
      const putBody = JSON.parse(putResponse.body);
      expect(putBody.data.frequency).toBe('weekly');
      expect(putBody.data.enabled).toBe(false);
      expect(putBody.data.includeNotifications).toBe(false);
      expect(putBody.data.includeReports).toBe(false);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'send-now returns an error when SMTP is not configured',
    async () => {
      const externalId = `email_digest_send_${Date.now()}`;
      await resolveAuthUser(externalId, `${externalId}@test.local`);
      resetEmailTransporter();

      const app = await buildTestApp(async (app) => {
        await app.register(emailDigestRoutes, { prefix: '/v1/email-digest' });
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/email-digest/me/send-now',
        headers: { authorization: `Bearer ${externalId}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.sent).toBe(false);
      expect(body.data.error).toContain('Email transport not configured');
    }
  );
});
