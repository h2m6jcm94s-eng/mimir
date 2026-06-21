import { expect, test } from '@playwright/test';
import { signInAsTestUser } from '../fixtures/auth';

test.describe('Agent reputation', () => {
  test.beforeEach(async ({ context }) => {
    await signInAsTestUser(context);
  });

  test('page loads with empty state', async ({ page }) => {
    await page.goto('/agents/reputation');
    await expect(page.locator('h2', { hasText: 'Agent reputation' })).toBeVisible();
    await expect(page.getByText('No reputation data yet')).toBeVisible();
  });
});
