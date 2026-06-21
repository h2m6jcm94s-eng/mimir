import { expect, test } from '@playwright/test';
import { signInAsTestUser } from '../fixtures/auth';

test.describe('Browser extension', () => {
  test.beforeEach(async ({ context }) => {
    await signInAsTestUser(context);
  });

  test('loads the extension onboarding page', async ({ page }) => {
    await page.goto('/extension');
    await expect(page.locator('h2', { hasText: 'Browser extension' })).toBeVisible();
    await expect(page.getByText('Capture the web into your second brain')).toBeVisible();
  });
});
