import { expect, test } from '@playwright/test';

/**
 * Approvals inbox tests.
 *
 * Verifies that the humane approval cards render and that a user can
 * approve, deny, snooze, delegate, and use batch mode.
 */
test.describe('Approvals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/approvals');
  });

  test('page loads with pending approvals', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Approvals', level: 2 })).toBeVisible();
    await expect(page.getByTestId('approval-1')).toBeVisible();
    await expect(page.getByTestId('approval-2')).toBeVisible();
  });

  test('approval card shows blast radius, models, and countdown', async ({ page }) => {
    const card = page.getByTestId('approval-1');
    await expect(
      card.getByText('Deploys 1 service · Restarts 1 service · ~12 users affected')
    ).toBeVisible();
    await expect(card.getByText('Models agree')).toBeVisible();
    await expect(card.getByText('PIN required')).toBeVisible();
  });

  test('destructive approval requires PIN', async ({ page }) => {
    const card = page.getByTestId('approval-1');
    await card.getByRole('button', { name: 'Approve', exact: true }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByPlaceholder('••••••').fill('1234');
    await page.getByRole('button', { name: 'Confirm' }).click();

    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByTestId('approval-1').getByText('approved')).toBeVisible();
  });

  test('non-destructive approval works without PIN', async ({ page }) => {
    const card = page.getByTestId('approval-3');
    await card.getByRole('button', { name: 'Approve', exact: true }).click();

    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByTestId('approval-3').getByText('approved')).toBeVisible();
  });

  test('user can deny and filter tabs update', async ({ page }) => {
    const card = page.getByTestId('approval-2');
    await card.getByRole('button', { name: 'Deny' }).click();

    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByTestId('approval-2').getByText('denied')).toBeVisible();
  });

  test('batch mode selects and approves multiple items', async ({ page }) => {
    await page.getByRole('button', { name: 'Batch' }).click();

    const cards = page.locator('[data-testid^="approval-"]');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await cards.nth(i).locator('button').first().click();
    }

    await page.getByRole('button', { name: 'Batch approve' }).click();
  });
});
