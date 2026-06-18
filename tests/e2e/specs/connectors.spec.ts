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
    await expect(page.getByText('Gmail')).toBeVisible();
    await expect(page.getByText('GitHub')).toBeVisible();
    await expect(page.getByText('Discord')).toBeVisible();
    await expect(page.getByText('Airtable')).toBeVisible();
    await expect(page.getByText('Google Contacts')).toBeVisible();
    await expect(page.getByText('Google Docs')).toBeVisible();
    await expect(page.getByText('Microsoft Outlook')).toBeVisible();
  });

  test('category filters show only matching connectors', async ({ page }) => {
    await page.getByRole('button', { name: 'Dev' }).click();
    await expect(page.getByText('GitHub')).toBeVisible();
    await expect(page.getByText('Gmail')).not.toBeVisible();

    await page.getByRole('button', { name: 'Productivity' }).click();
    await expect(page.getByText('Airtable')).toBeVisible();
    await expect(page.getByText('GitHub')).not.toBeVisible();
  });

  test('search narrows results', async ({ page }) => {
    await page.locator('input[placeholder="Search connectors"]').fill('Notion');
    await expect(page.getByText('Notion')).toBeVisible();
    await expect(page.getByText('GitHub')).not.toBeVisible();

    await page.locator('input[placeholder="Search connectors"]').fill('Outlook');
    await expect(page.getByText('Microsoft Outlook')).toBeVisible();
    await expect(page.getByText('GitHub')).not.toBeVisible();
  });

  test('connect button toggles connector status', async ({ page }) => {
    const github = page.getByTestId('connector-github');
    const status = github.getByTestId('connector-status');
    const current = await status.textContent();
    if (current?.trim() === 'Connected') {
      await github.getByTestId('connector-toggle').click();
      await expect(status).toHaveText('Disconnected');
    }
    await github.getByTestId('connector-toggle').click();
    await expect(status).toHaveText('Connected');
  });
});
