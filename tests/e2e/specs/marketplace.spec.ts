import { expect, test } from '@playwright/test';

/**
 * Marketplace page tests.
 */
test.describe('Marketplace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/marketplace');
  });

  test('page loads with listing cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Marketplace', level: 2 })).toBeVisible();
    await expect(page.getByText('Meeting Notes Pro')).toBeVisible();
    await expect(page.getByText('Terminal Copilot')).toBeVisible();
  });

  test('kind filters show only matching listings', async ({ page }) => {
    await page.getByRole('button', { name: 'Skill' }).click();
    await expect(page.getByText('Meeting Notes Pro')).toBeVisible();
    await expect(page.getByText('Gmail Connector')).not.toBeVisible();
  });

  test('search narrows results', async ({ page }) => {
    await page.locator('input[placeholder="Search marketplace"]').fill('render');
    await expect(page.getByText('Cloud Render')).toBeVisible();
    await expect(page.getByText('Meeting Notes Pro')).not.toBeVisible();
  });

  test('install button toggles installed state', async ({ page }) => {
    const item = page.getByTestId('listing-figma-connector');
    await expect(item.getByTestId('listing-install')).toContainText('Install');
    await item.getByTestId('listing-install').click();
    await expect(item.getByTestId('listing-install')).toContainText('Installed');
  });
});
