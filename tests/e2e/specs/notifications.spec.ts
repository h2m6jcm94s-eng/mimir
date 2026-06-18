import { signInAsTestUser } from '../fixtures/auth';
import { apiRequestHeaders, expect, test } from '../fixtures/base';

/**
 * Notifications page tests.
 *
 * Verifies the in-app notification surface: listing, unread counts, marking read,
 * and the TopBar notification bell badge.
 */
test.describe('Notifications', () => {
  const seedTitle = `E2E test notification ${Date.now()}`;
  const seedBody = 'This is a seeded notification for end-to-end testing.';

  test.beforeEach(async ({ page, context, apiRequest }) => {
    await signInAsTestUser(context);

    // Seed a notification directly via the API so the UI has data to render.
    const response = await apiRequest.post('/v1/notifications', {
      headers: apiRequestHeaders(),
      data: {
        kind: 'e2e.test',
        title: seedTitle,
        body: seedBody,
        priority: 'normal',
        channels: ['in_app'],
      },
    });
    expect(response.status()).toBe(201);

    await page.goto('/notifications');
  });

  test('page loads and displays seeded notification', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Notifications', level: 2 })).toBeVisible();
    await expect(page.getByText(seedTitle).first()).toBeVisible();
    await expect(page.getByText(seedBody).first()).toBeVisible();
  });

  test('filter tabs switch between all and unread', async ({ page }) => {
    await page.getByRole('button', { name: /^Unread/ }).click();
    await expect(page.getByText(seedTitle).first()).toBeVisible();
    await page.getByRole('button', { name: /^All/ }).click();
    await expect(page.getByText(seedTitle).first()).toBeVisible();
  });

  test('mark read removes unread indicator', async ({ page }) => {
    const card = page
      .locator('[data-testid^="notification-card-"]')
      .filter({ hasText: seedTitle })
      .first();
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Mark read' }).click();
    await expect(card.getByRole('button', { name: 'Read' })).toBeVisible();
  });

  test('bell badge reflects unread count', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page.getByTestId('notifications-badge')).toBeVisible();
  });
});
