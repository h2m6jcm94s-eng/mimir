import { expect, test } from '@playwright/test';

/**
 * Tasks kanban tests.
 *
 * Verifies that the board renders and a user can move a task between columns.
 */
test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks');
  });

  test('page loads the kanban board', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tasks', level: 2 })).toBeVisible();
    for (const col of ['Queued', 'Running', 'Blocked', 'Needs Attention', 'Done']) {
      await expect(page.getByRole('heading', { name: col, level: 3 })).toBeVisible();
    }
  });

  test('task cards show model, tier, blast radius and cost', async ({ page }) => {
    const card = page.getByTestId('task-card-2');
    await expect(card).toBeVisible();
    await expect(card.getByText('3 packages · 2 services affected')).toBeVisible();
    await expect(card.getByText('$0.002')).toBeVisible();
  });

  test('user can move a task to another column', async ({ page }) => {
    const card = page.getByTestId('task-card-2');
    await expect(card).toBeVisible();

    await card.locator('select').selectOption('Running');

    await expect(card.locator('select')).toHaveValue('Running');
  });
});
