import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

test.describe('Life admin', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/life-admin');
  });

  test('page loads with form and empty state', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Life admin', level: 2 })).toBeVisible();
    await expect(page.getByTestId('life-admin-title')).toBeVisible();
    await expect(page.getByTestId('life-admin-due-date')).toBeVisible();
    await expect(page.getByText('No life admin items found.')).toBeVisible();
  });

  test('creates a one-time item and marks it done', async ({ page }) => {
    const title = `Dentist appointment ${Date.now()}`;
    await page.getByTestId('life-admin-title').fill(title);
    await page.getByTestId('life-admin-description').fill('Routine dental checkup.');
    await page.getByTestId('life-admin-due-date').fill('2030-12-31');
    await page.getByTestId('life-admin-category').fill('Health');
    await page.getByTestId('life-admin-tags').fill('health, personal');

    await page.getByRole('button', { name: 'Add item' }).click();

    const list = page.getByTestId('life-admin-list');
    await expect(list.getByText(title)).toBeVisible();
    await expect(list.getByText('Routine dental checkup.').first()).toBeVisible();
    await expect(list.getByText('Health').first()).toBeVisible();

    await list
      .getByTestId(`life-admin-card-${title}`)
      .getByRole('button', { name: 'Done' })
      .click();

    await expect(list.getByText(title)).toHaveCount(0);
  });

  test('recurring item spawns a next occurrence when completed', async ({ page }) => {
    const title = `Water plants ${Date.now()}`;
    await page.getByTestId('life-admin-title').fill(title);
    await page
      .getByTestId('life-admin-description')
      .fill('Check soil moisture and water if needed.');
    await page.getByTestId('life-admin-due-date').fill('2030-06-15');
    await page.getByTestId('life-admin-recurrence').selectOption('weekly');

    await page.getByRole('button', { name: 'Add item' }).click();

    const list = page.getByTestId('life-admin-list');
    await expect(list.getByText(title)).toBeVisible();
    await expect(list.getByText('Weekly').first()).toBeVisible();

    await list
      .getByTestId(`life-admin-card-${title}`)
      .getByRole('button', { name: 'Done' })
      .click();

    await expect(list.getByText(title)).toHaveCount(1);
  });
});
