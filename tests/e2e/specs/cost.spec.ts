import { expect, test } from '@playwright/test';
import { signInAsTestUser } from '../fixtures/auth';

/**
 * Cost page tests.
 *
 * Verifies budget summary, charts, and transaction breakdown render.
 */
test.describe('Cost', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/cost');
  });

  test('page loads with summary cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Cost', level: 2 })).toBeVisible();
    await expect(
      page.getByText('Track token spend, model usage, and budget health.')
    ).toBeVisible();
    await expect(page.getByText('Total today')).toBeVisible();
    await expect(page.getByText('Projected EOD')).toBeVisible();
    await expect(page.getByText('Budget remaining')).toBeVisible();
    await expect(page.getByText('Top skill')).toBeVisible();
  });

  test('daily spend and tier charts render', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Daily spend', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Spend by tier', level: 3 })).toBeVisible();
  });

  test('transaction table renders', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Recent transactions', level: 3 })
    ).toBeVisible();
    await expect(page.getByText(/\d+ shown/)).toBeVisible();
  });
});
