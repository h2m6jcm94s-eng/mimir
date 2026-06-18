import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { marketingRoutes } from './marketing';

describe('marketing routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(marketingRoutes, { prefix: '/v1/marketing' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/marketing/campaigns',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'creates brand voices, campaigns, calendar items and generates a draft',
    async () => {
      const token = `marketing_user_${Date.now()}`;
      await resolveAuthUser(token, `${token}@test.local`);

      const app = await buildTestApp(async (app) => {
        await app.register(marketingRoutes, { prefix: '/v1/marketing' });
      });

      const voiceResponse = await app.inject({
        method: 'POST',
        url: '/v1/marketing/brand-voices',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({
          name: 'Agency Default',
          tone: 'professional but playful',
          audience: 'SaaS founders',
          guidelines: 'Use short sentences. Avoid jargon.',
          sampleText: 'Grow faster without the chaos.',
          isDefault: true,
        }),
      });
      expect(voiceResponse.statusCode).toBe(201);
      const voice = JSON.parse(voiceResponse.body).data;
      expect(voice.name).toBe('Agency Default');

      const campaignResponse = await app.inject({
        method: 'POST',
        url: '/v1/marketing/campaigns',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({
          brandVoiceId: voice.id,
          name: 'Q3 Launch',
          goal: 'Drive trial signups for the new agency dashboard.',
          status: 'active',
          budget: 5000,
          metrics: { impressions: 12000, clicks: 800, conversions: 45 },
        }),
      });
      expect(campaignResponse.statusCode).toBe(201);
      const campaign = JSON.parse(campaignResponse.body).data;
      expect(campaign.name).toBe('Q3 Launch');
      expect(campaign.metrics.conversions).toBe(45);

      const calendarResponse = await app.inject({
        method: 'POST',
        url: '/v1/marketing/calendar',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({
          campaignId: campaign.id,
          title: 'Launch tweet thread',
          platform: 'twitter',
          scheduledAt: new Date().toISOString(),
        }),
      });
      expect(calendarResponse.statusCode).toBe(201);
      const item = JSON.parse(calendarResponse.body).data;
      expect(item.platform).toBe('twitter');

      const generateResponse = await app.inject({
        method: 'POST',
        url: `/v1/marketing/calendar/${item.id}/generate`,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({ topic: 'Why agencies need a brain' }),
      });
      expect(generateResponse.statusCode).toBe(200);
      const generated = JSON.parse(generateResponse.body).data;
      expect(generated.body).toContain('Why agencies need a brain');
      expect(generated.body).toContain('professional but playful');

      const analyticsResponse = await app.inject({
        method: 'GET',
        url: '/v1/marketing/analytics',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(analyticsResponse.statusCode).toBe(200);
      const analytics = JSON.parse(analyticsResponse.body).data;
      expect(analytics.campaigns.total).toBeGreaterThan(0);
      expect(analytics.totals.conversions).toBe(45);
    }
  );
});
