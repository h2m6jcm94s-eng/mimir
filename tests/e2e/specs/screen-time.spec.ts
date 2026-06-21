import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

test.describe('Screen time', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/screen-time');
  });

  test('page loads with empty state', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Screen time', level: 2 })).toBeVisible();
    await expect(page.getByTestId('screen-time-date')).toBeVisible();
    await expect(page.getByText('No screen-time entries yet.')).toBeVisible();
  });

  test('logs a screen-time entry and shows it in the list', async ({ page }) => {
    const app = `TestApp ${Date.now()}`;

    await page.getByTestId('screen-time-app').fill(app);
    await page.getByTestId('screen-time-category').fill('Testing');
    await page.getByTestId('screen-time-minutes').fill('30');
    await page.getByRole('button', { name: 'Log entry' }).click();

    const entry = page.locator('[data-testid^="screen-time-entry-"]').first();
    await expect(entry.getByText(app)).toBeVisible();
    await expect(entry.getByText('Testing')).toBeVisible();
    await expect(entry.getByText('30 min')).toBeVisible();
    await entry.getByTestId(/^screen-time-delete-/).click();

    await expect(page.getByText('No screen-time entries yet.')).toBeVisible();
  });
});
