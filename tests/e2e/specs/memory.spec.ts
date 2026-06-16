import { expect, test } from '@playwright/test';

/**
 * Memory page tests.
 */
test.describe('Memory', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/memory');
  });

  test('page loads with time machine', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Memory', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Time Machine' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Current/ })).toBeVisible();
  });

  test('user can switch to graph memory', async ({ page }) => {
    await page.getByRole('button', { name: 'Graph Memory' }).click();
    await expect(page.locator('.react-flow')).toBeVisible();
  });

  test('hovering a checkpoint updates diff view', async ({ page }) => {
    await page.getByText('Security brief absorbed').hover();
    await expect(page.getByText('Security brief absorbed → Current')).toBeVisible();
  });

  test('rewind, restore, and branch buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Rewind' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Branch' })).toBeVisible();
  });
});
