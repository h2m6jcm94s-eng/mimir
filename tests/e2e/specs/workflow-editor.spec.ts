import { expect, test } from '@playwright/test';
import { signInAsTestUser } from '../fixtures/auth';

test.describe('Workflow visual editor', () => {
  test.beforeEach(async ({ context }) => {
    await signInAsTestUser(context);
  });

  test('loads the visual editor', async ({ page }) => {
    await page.goto('/workflow-editor');
    await expect(page.locator('h2', { hasText: 'Workflow visual editor' })).toBeVisible();
  });
});
