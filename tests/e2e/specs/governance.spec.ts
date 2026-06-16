import { expect, test } from '@playwright/test';

/**
 * Governance page tests.
 */
test.describe('Governance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/governance');
  });

  test('policy tab shows YAML editor and validation badge', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Governance', level: 2 })).toBeVisible();
    await expect(page.getByText('Valid YAML')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('invalid YAML shows error badge', async ({ page }) => {
    await page.locator('textarea').fill('invalid content');
    await expect(page.getByTestId('policy-invalid')).toBeVisible();
  });

  test('audit log tab renders hash-chain table', async ({ page }) => {
    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page.getByText('Verify chain')).toBeVisible();
    await expect(page.getByText('key rotation completed')).toBeVisible();
  });

  test('privacy flow map renders', async ({ page }) => {
    await page.getByRole('button', { name: 'Privacy Flow' }).click();
    await expect(page.getByText('Privacy flow map')).toBeVisible();
    await expect(page.getByText('Classifier')).toBeVisible();
    await expect(page.getByText('Local node')).toBeVisible();
  });
});
