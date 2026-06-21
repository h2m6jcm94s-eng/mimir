import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

test.describe('Mimir Local settings', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/settings');
  });

  test('shows the Mimir Local tab and download button', async ({ page }) => {
    await page.getByRole('button', { name: 'Mimir Local' }).click();
    await expect(page.getByText('Mimir Local runtime')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download Mimir Local' })).toBeVisible();
  });

  test('reports offline when Ollama is not running', async ({ page }) => {
    await page.getByRole('button', { name: 'Mimir Local' }).click();
    await expect(page.getByText('Offline')).toBeVisible();
  });
});
