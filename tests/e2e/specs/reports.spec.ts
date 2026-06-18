import { signInAsTestUser } from '../fixtures/auth';
import { apiRequestHeaders, expect, test } from '../fixtures/base';

/**
 * Reports page tests.
 */
test.describe('Reports', () => {
  test.beforeEach(async ({ page, context, apiRequest }) => {
    await signInAsTestUser(context);
    await page.goto('/reports');
  });

  test('page loads with report cards and usage insights', async ({ page, apiRequest }) => {
    const suffix = `load-${Date.now()}`;
    const reports = [
      {
        title: `Security Audit ${suffix}`,
        description: 'CVE scan, access review, and policy exceptions.',
        kind: 'security',
        status: 'ready',
      },
      {
        title: `Weekly Cost Report ${suffix}`,
        description: 'Token spend by model, tier, and skill.',
        kind: 'cost',
        status: 'ready',
      },
    ];

    for (const report of reports) {
      const response = await apiRequest.post('/v1/reports', {
        headers: apiRequestHeaders(),
        data: report,
      });
      expect(response.status()).toBe(201);
    }

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Reports', level: 2 })).toBeVisible();
    await expect(page.getByText('Usage insights')).toBeVisible();
    await expect(page.getByText('Tasks completed')).toBeVisible();
    await expect(page.getByText('Time saved')).toBeVisible();
    await expect(page.getByText('Automation rate')).toBeVisible();
    await expect(page.getByText(`Security Audit ${suffix}`).first()).toBeVisible();
    await expect(page.getByText(`Weekly Cost Report ${suffix}`).first()).toBeVisible();
  });

  test('kind filters show only matching reports', async ({ page, apiRequest }) => {
    const suffix = `filter-${Date.now()}`;
    const reports = [
      {
        title: `Security Audit ${suffix}`,
        description: 'CVE scan and access review.',
        kind: 'security',
        status: 'ready',
      },
      {
        title: `Weekly Cost Report ${suffix}`,
        description: 'Token spend by model and tier.',
        kind: 'cost',
        status: 'ready',
      },
    ];

    for (const report of reports) {
      const response = await apiRequest.post('/v1/reports', {
        headers: apiRequestHeaders(),
        data: report,
      });
      expect(response.status()).toBe(201);
    }

    await page.reload();

    await page.getByTestId('report-filters').getByRole('button', { name: 'Cost' }).click();
    await expect(page.getByText(`Weekly Cost Report ${suffix}`).first()).toBeVisible();
    await expect(page.getByText(`Security Audit ${suffix}`)).not.toBeVisible();
  });

  test('search narrows results', async ({ page, apiRequest }) => {
    const suffix = `search-${Date.now()}`;
    const reports = [
      {
        title: `Security Audit ${suffix}`,
        description: 'CVE scan and access review.',
        kind: 'security',
        status: 'ready',
      },
      {
        title: `Q2 Compliance Summary ${suffix}`,
        description: 'Governance log attestations.',
        kind: 'compliance',
        status: 'scheduled',
      },
    ];

    for (const report of reports) {
      const response = await apiRequest.post('/v1/reports', {
        headers: apiRequestHeaders(),
        data: report,
      });
      expect(response.status()).toBe(201);
    }

    await page.reload();

    await page.locator('input[placeholder="Search reports"]').fill('compliance');
    await expect(page.getByText(`Q2 Compliance Summary ${suffix}`).first()).toBeVisible();
    await expect(page.getByText(`Security Audit ${suffix}`)).not.toBeVisible();
  });

  test('generating report has disabled download', async ({ page, apiRequest }) => {
    const suffix = `generating-${Date.now()}`;
    const response = await apiRequest.post('/v1/reports', {
      headers: apiRequestHeaders(),
      data: {
        title: `Mesh Health Snapshot ${suffix}`,
        description: 'Node uptime, latency, and queue depth.',
        kind: 'security',
        status: 'generating',
      },
    });
    expect(response.status()).toBe(201);

    await page.reload();

    const mesh = page
      .locator('[data-testid^="report-"]')
      .filter({ hasText: `Mesh Health Snapshot ${suffix}` })
      .first();
    await expect(mesh.getByTestId('report-status')).toHaveText('generating');
    await expect(mesh.getByRole('button', { name: 'Download' })).toBeDisabled();
  });
});
