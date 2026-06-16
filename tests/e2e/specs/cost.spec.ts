import { expect, test } from '@playwright/test';

/**
 * Cost page tests.
 *
 * Verifies budget summary, charts, and transaction breakdown render.
 */
test.describe('Cost', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cost');
  });

  test('page loads with summary cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Cost', level: 2 })).toBeVisible();
    await expect(
      page.getByText('Track token spend, model usage, and budget health.')
    ).toBeVisible();
    await expect(page.getByText('Total today')).toBeVisible();
    await expect(page.getByText('Projected this week')).toBeVisible();
    await expect(page.getByText('Budget remaining')).toBeVisible();
    await expect(page.getByText('Top model')).toBeVisible();
  });

  test('daily spend and tier charts render', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Daily spend', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Spend by tier', level: 3 })).toBeVisible();
  });

  test('transaction table lists recent usage', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Recent transactions', level: 3 })
    ).toBeVisible();
    await expect(page.getByText('Security brief')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Kimi K2' }).first()).toBeVisible();
  });

  test('budget alert appears when projected spend exceeds limit', async ({ page }) => {
    await expect(page.getByText(/Projected weekly spend/)).toBeVisible();
    await page.locator('#budget-input').fill('100');
    await expect(page.getByText(/Projected weekly spend/)).not.toBeVisible();
  });
});
