import { expect, test } from '@playwright/test';

/**
 * Knowledge page tests.
 */
test.describe('Knowledge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/knowledge');
  });

  test('page loads with documents and screenshots', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Knowledge', level: 2 })).toBeVisible();
    await expect(page.getByText('Security runbook')).toBeVisible();
    await expect(page.getByText('Screenshot: billing page')).toBeVisible();
  });

  test('tabs filter by kind', async ({ page }) => {
    await page.getByRole('button', { name: 'Documents' }).click();
    await expect(page.getByText('Security runbook')).toBeVisible();
    await expect(page.getByText('Screenshot: billing page')).not.toBeVisible();

    await page.getByRole('button', { name: 'Screenshots' }).click();
    await expect(page.getByText('Screenshot: billing page')).toBeVisible();
    await expect(page.getByText('Security runbook')).not.toBeVisible();
  });

  test('search narrows results', async ({ page }) => {
    await page.getByPlaceholder('Search knowledge...').fill('billing');
    await expect(page.getByText('Screenshot: billing page')).toBeVisible();
    await expect(page.getByText('Security runbook')).not.toBeVisible();
  });

  test('clicking a screenshot opens lightbox', async ({ page }) => {
    await page.getByText('Screenshot: billing page').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('dialog').getByText('Total: $142.50 · Invoice #9921')
    ).toBeVisible();
  });
});
