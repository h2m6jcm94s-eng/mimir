import { expect, test } from '@playwright/test';

/**
 * Briefings page tests.
 *
 * Verifies that a real user can view, filter, search, and interact with
 * the PA-style briefings surface.
 */
test.describe('Briefings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/briefings');
  });

  test('page loads with all briefings visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Briefings', level: 2 })).toBeVisible();
    await expect(page.getByText('Daily Security Brief')).toBeVisible();
    await expect(page.getByText('Q3 Budget Review')).toBeVisible();
    await expect(page.getByText('Design Sync')).toBeVisible();
  });

  test('filter tabs show only matching kinds', async ({ page }) => {
    await page.getByRole('button', { name: 'Emails' }).click();
    await expect(page.getByText('Q3 Budget Review')).toBeVisible();
    await expect(page.getByText('Daily Security Brief')).not.toBeVisible();

    await page.getByRole('button', { name: 'Meetings' }).click();
    await expect(page.getByText('Design Sync')).toBeVisible();
    await expect(page.getByText('Q3 Budget Review')).not.toBeVisible();

    await page.getByRole('button', { name: 'Important' }).click();
    await expect(page.getByText('Daily Security Brief')).toBeVisible();
    await expect(page.getByText('Design Sync')).not.toBeVisible();
  });

  test('search narrows results', async ({ page }) => {
    await page.getByPlaceholder('Search briefings...').fill('Clerk');
    await expect(page.getByText('Important: Clerk Key Rotation')).toBeVisible();
    await expect(page.getByText('Daily Security Brief')).not.toBeVisible();
  });

  test('action buttons are visible on a briefing card', async ({ page }) => {
    const card = page.locator('.rounded-xl', { hasText: 'Daily Security Brief' });
    await expect(card.getByRole('button', { name: 'Email' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Task' })).toBeVisible();
  });
});
