import { expect, test } from '@playwright/test';
import { signInAsTestUser } from '../fixtures/auth';

/**
 * Connectors page tests.
 */
test.describe('Connectors', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/connectors');
  });

  test('page loads with connector cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Connectors', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gmail' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'GitHub' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Discord' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Airtable' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Google Contacts' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Google Docs' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Microsoft Outlook' })).toBeVisible();
  });

  test('category filters show only matching connectors', async ({ page }) => {
    await page.getByRole('button', { name: 'Dev' }).click();
    await expect(page.getByRole('heading', { name: 'GitHub' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gmail' })).not.toBeVisible();

    await page.getByRole('button', { name: 'Productivity' }).click();
    await expect(page.getByRole('heading', { name: 'Airtable' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'GitHub' })).not.toBeVisible();
  });

  test('search narrows results', async ({ page }) => {
    await page.locator('input[placeholder="Search connectors"]').fill('Notion');
    await expect(page.getByRole('heading', { name: 'Notion' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'GitHub' })).not.toBeVisible();

    await page.locator('input[placeholder="Search connectors"]').fill('Outlook');
    await expect(page.getByRole('heading', { name: 'Microsoft Outlook' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'GitHub' })).not.toBeVisible();
  });

  test('connect button toggles connector status', async ({ page }) => {
    const github = page.getByTestId('connector-github');
    const status = github.getByTestId('connector-status');
    const current = await status.textContent();
    if (current?.trim() === 'Connected') {
      await github.getByTestId('connector-toggle').click();
      await expect(status).toHaveText('Disconnected');
    }

    // GitHub has a setup panel, so fill in the token before toggling.
    await github.locator('input[type="password"]').fill('ghp_dummy_token_for_tests');
    await github.getByTestId('connector-toggle').click();
    await expect(status).toHaveText('Connected');
  });
});
