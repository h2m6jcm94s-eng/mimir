import { expect, test } from '@playwright/test';
import { signInAsTestUser } from '../fixtures/auth';

test.describe('Voice companion', () => {
  test.beforeEach(async ({ context }) => {
    await signInAsTestUser(context);
  });

  test('loads the voice page', async ({ page }) => {
    await page.goto('/voice');
    await expect(page.locator('h2', { hasText: 'Voice companion' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start listening' })).toBeVisible();
  });
});
