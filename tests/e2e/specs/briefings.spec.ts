import { signInAsTestUser } from '../fixtures/auth';
import { apiRequestHeaders, expect, test } from '../fixtures/base';

/**
 * Briefings page tests.
 *
 * Verifies that a real user can generate, view, filter, search, and interact with
 * the PA-style briefings surface backed by live API data.
 */
test.describe('Briefings', () => {
  test.beforeAll(async ({ apiRequest }) => {
    const response = await apiRequest.post('/v1/briefings/generate', {
      headers: apiRequestHeaders(),
      data: {},
    });
    expect(response.status()).toBe(201);
  });

  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/briefings');
  });

  test('page loads with all briefings visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Briefings', level: 2 })).toBeVisible();
    await expect(page.getByText('Daily Task Brief').first()).toBeVisible();
    await expect(page.getByText('Daily Stand-up').first()).toBeVisible();
  });

  test('filter tabs show only matching kinds', async ({ page }) => {
    await page.getByRole('button', { name: 'Emails' }).click();
    await expect(page.getByText('Daily Task Brief')).toHaveCount(0);

    await page.getByRole('button', { name: 'Meetings' }).click();
    await expect(page.getByText('Daily Stand-up').first()).toBeVisible();
    await expect(page.getByText('Daily Task Brief')).toHaveCount(0);

    await page.getByRole('button', { name: 'Important' }).click();
    await expect(page.getByText('Daily Stand-up')).toHaveCount(0);
  });

  test('search narrows results', async ({ page }) => {
    await page.getByPlaceholder('Search briefings...').fill('Daily Task Brief');
    await expect(page.getByText('Daily Task Brief').first()).toBeVisible();
    await expect(page.getByText('Daily Stand-up')).toHaveCount(0);
  });

  test('action buttons are visible on a briefing card', async ({ page }) => {
    const card = page.locator('.rounded-xl').filter({ hasText: 'Daily Task Brief' }).first();
    await expect(card.getByRole('button', { name: 'Email' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Task' })).toBeVisible();
  });
});
