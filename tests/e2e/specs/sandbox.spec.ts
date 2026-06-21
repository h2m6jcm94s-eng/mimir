import { expect, test } from '@playwright/test';
import { signInAsTestUser } from '../fixtures/auth';

test.describe('Sandbox playground', () => {
  test.beforeEach(async ({ context }) => {
    await signInAsTestUser(context);
  });

  test('loads the analyze tab', async ({ page }) => {
    await page.goto('/sandbox');
    await expect(page.locator('h2', { hasText: 'Sandbox playground' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analyze' })).toBeVisible();
  });
});
