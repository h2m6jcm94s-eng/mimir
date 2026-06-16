import { expect, test } from '@playwright/test';

/**
 * Scaffold web tests.
 *
 * Verifies that a real user can open the Next.js app, see the console, and
 * interact with the chat input, attachments, and advanced controls without
 * hitting Clerk gating in test mode.
 */
test.describe('Web scaffold', () => {
  test('homepage loads the Mimir console', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Mimir/);
    await expect(page.getByPlaceholder('Ask Mimir anything...')).toBeVisible();
    await expect(page.getByText('T1 · Auto')).toBeVisible();
  });

  test('user can type a question, send, and see a reply', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder('Ask Mimir anything...');
    await expect(input).toBeVisible();

    await input.fill('What did we decide last week?');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(input).toHaveValue('');
    await expect(page.getByText('What did we decide last week?')).toBeVisible();
    await expect(page.getByText('I have queued that task.')).toBeVisible({ timeout: 5000 });
  });

  test('user can open attachments and advanced controls', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Attachments' }).click();
    await expect(page.getByRole('button', { name: 'Voice', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Advanced' }).click();
    await expect(page.getByText('Privacy tier')).toBeVisible();
    await expect(page.getByText('Show raw tool calls')).toBeVisible();
  });
});
