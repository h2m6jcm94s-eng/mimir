import { expect, test } from '@playwright/test';
import { signInAsTestUser } from '../fixtures/auth';

test.describe('Model leaderboard', () => {
  test.beforeEach(async ({ context }) => {
    await signInAsTestUser(context);
  });

  test('page loads with empty state', async ({ page }) => {
    await page.goto('/model-leaderboard');
    await expect(page.locator('h2', { hasText: 'Model leaderboard' })).toBeVisible();
    await expect(page.getByText('No model invocations yet')).toBeVisible();
  });
});
