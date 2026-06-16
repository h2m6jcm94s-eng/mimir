import { expect, test } from '@playwright/test';

/**
 * Connectors page tests.
 */
test.describe('Connectors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/connectors');
  });

  test('page loads with connector cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Connectors', level: 2 })).toBeVisible();
    await expect(page.getByText('Gmail')).toBeVisible();
    await expect(page.getByText('GitHub')).toBeVisible();
  });

  test('category filters show only matching connectors', async ({ page }) => {
    await page.getByRole('button', { name: 'Dev' }).click();
    await expect(page.getByText('GitHub')).toBeVisible();
    await expect(page.getByText('Gmail')).not.toBeVisible();
  });

  test('search narrows results', async ({ page }) => {
    await page.locator('input[placeholder="Search connectors"]').fill('Notion');
    await expect(page.getByText('Notion')).toBeVisible();
    await expect(page.getByText('GitHub')).not.toBeVisible();
  });

  test('connect button toggles connector status', async ({ page }) => {
    const figma = page.getByTestId('connector-figma');
    await expect(figma.getByTestId('connector-status')).toHaveText('Disconnected');
    await figma.getByTestId('connector-toggle').click();
    await expect(figma.getByTestId('connector-status')).toHaveText('Connected');
  });
});
