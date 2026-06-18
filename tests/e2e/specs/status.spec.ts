import { expect, test } from '@playwright/test';
import { apiHeaders, signInAsTestUser } from '../fixtures/auth';

/**
 * Status page tests.
 *
 * Verifies that the live topology, node cards, and health summary render with
 * real API data.
 */
test.describe('Status', () => {
  test.beforeEach(async ({ page, context, request }) => {
    await signInAsTestUser(context);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    for (const [kind, status] of [
      ['brain', 'up'],
      ['desktop', 'up'],
      ['cloud', 'down'],
      ['phone', 'up'],
    ] as const) {
      await request.post('/api/v1/nodes/enroll', {
        headers: apiHeaders(),
        data: {
          kind,
          name: `${kind}-${suffix}`,
          tier: 1,
        },
      });
    }

    await page.goto('/status');
  });

  test('page loads the status dashboard', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Status', level: 2 })).toBeVisible();
    await expect(page.getByText('Live mesh topology, nodes, and active jobs.')).toBeVisible();
  });

  test('mesh health summary is visible', async ({ page }) => {
    await expect(page.getByText('Mesh Degraded')).toBeVisible();
    await expect(page.getByText('3/4 nodes online')).toBeVisible();
  });

  test('node cards show jobs and cost', async ({ page }) => {
    const brain = page.getByText('brain-', { exact: false }).first();
    await expect(brain).toBeVisible();
    const card = brain.locator('xpath=ancestor::*[contains(@data-testid, "node-card-")]');
    await expect(card.getByText('Active jobs')).toBeVisible();
    await expect(card.getByText('Cost today')).toBeVisible();
  });

  test('queue chart and cost widget render', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Task queue depth', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cost today', level: 3 })).toBeVisible();
  });
});
