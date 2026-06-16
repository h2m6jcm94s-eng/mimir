import { expect, test } from '@playwright/test';

/**
 * Status page tests.
 *
 * Verifies that the live topology, node cards, and health summary render
 * and that a user can see the mesh status at a glance.
 */
test.describe('Status', () => {
  test.beforeEach(async ({ page }) => {
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

  test('node cards show metrics and cost', async ({ page }) => {
    const laptop = page.getByTestId('node-card-laptop');
    await expect(laptop).toBeVisible();
    await expect(laptop.getByText('CPU')).toBeVisible();
    await expect(laptop.getByText('RAM')).toBeVisible();
    await expect(laptop.getByText('DSK')).toBeVisible();
    await expect(laptop.getByText('NET')).toBeVisible();
  });

  test('active jobs list and queue chart render', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Active jobs', level: 3 })).toBeVisible();
    await expect(page.getByText('Security brief review')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Task queue depth', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cost today', level: 3 })).toBeVisible();
  });
});
