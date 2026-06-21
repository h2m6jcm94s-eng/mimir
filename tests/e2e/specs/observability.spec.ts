import { expect, test } from '@playwright/test';
import { signInAsTestUser } from '../fixtures/auth';

test.describe('Observability', () => {
  test.beforeEach(async ({ context }) => {
    await signInAsTestUser(context);
  });

  test('loads the observability dashboard', async ({ page }) => {
    await page.goto('/observability');
    await expect(page.locator('h2', { hasText: 'Observability' })).toBeVisible();
    await expect(page.getByText('HTTP requests')).toBeVisible();
  });
});
