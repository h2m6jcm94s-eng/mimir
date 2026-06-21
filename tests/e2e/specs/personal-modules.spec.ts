import { expect, test } from '@playwright/test';
import { signInAsTestUser } from '../fixtures/auth';

test.describe('Personal modules', () => {
  test.beforeEach(async ({ context }) => {
    await signInAsTestUser(context);
  });

  test('finance module page loads and creates an item', async ({ page }) => {
    await page.goto('/modules/finance');
    await expect(page.locator('h2', { hasText: 'Personal finance' })).toBeVisible();

    await page.getByTestId('module-title').fill('Cancel subscription');
    await page.getByTestId('module-field-amount').fill('49.99');
    await page.getByTestId('module-field-category').fill('SaaS');

    await page.getByRole('button', { name: /Add item/i }).click();

    await expect(page.getByTestId('module-card-Cancel subscription')).toBeVisible();
    await expect(page.getByText('amount: 49.99')).toBeVisible();
  });

  test('marks a module item as done', async ({ page }) => {
    await page.goto('/modules/finance');

    await page.getByTestId('module-title').fill('Review budget');
    await page.getByRole('button', { name: /Add item/i }).click();

    const card = page.getByTestId('module-card-Review budget');
    await expect(card).toBeVisible();

    await card.getByTestId(/module-done-/i).click();
    await expect(card).not.toBeVisible();

    await page.getByRole('button', { name: 'done', exact: true }).click();
    await expect(page.getByTestId('module-card-Review budget')).toBeVisible();
  });
});
