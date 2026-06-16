import { expect, test } from '@playwright/test';

/**
 * Routines page tests.
 */
test.describe('Routines', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/routines');
  });

  test('page loads with routines list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Routines', level: 2 })).toBeVisible();
    await expect(page.getByText('Morning Brief')).toBeVisible();
    await expect(page.getByText('Dependency Audit')).toBeVisible();
  });

  test('trigger filters show only matching routines', async ({ page }) => {
    await page.getByRole('button', { name: 'Webhook' }).click();
    await expect(page.getByText('Standup Prep')).toBeVisible();
    await expect(page.getByText('Morning Brief')).not.toBeVisible();
  });

  test('search narrows results', async ({ page }) => {
    await page.locator('input[placeholder="Search routines"]').fill('report');
    await expect(page.getByText('Weekly Report')).toBeVisible();
    await expect(page.getByText('Morning Brief')).not.toBeVisible();
  });

  test('enable toggle changes routine status', async ({ page }) => {
    const weekly = page.getByTestId('routine-weekly-report');
    await expect(weekly.getByTestId('routine-status')).toHaveText('Disabled');
    await weekly.getByTestId('routine-toggle').click();
    await expect(weekly.getByTestId('routine-status')).toHaveText('Enabled');
  });

  test('run now updates last run text', async ({ page }) => {
    const weekly = page.getByTestId('routine-weekly-report');
    await expect(weekly.getByTestId('routine-last-run')).toContainText('Never');
    await weekly.getByTestId('routine-run').click();
    await expect(weekly.getByTestId('routine-last-run')).toContainText('Just now');
  });
});
