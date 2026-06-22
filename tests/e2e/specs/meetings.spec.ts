import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

test.describe('Meetings', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/meetings');
  });

  test('page loads with empty state', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Meetings', level: 2 })).toBeVisible();
    await expect(page.getByText('No meetings yet.')).toBeVisible();
  });

  test('creates a meeting and generates a prep draft', async ({ page }) => {
    const title = `Strategy sync ${Date.now()}`;

    await page.getByRole('button', { name: 'New meeting' }).click();
    await page.getByTestId('meeting-title').fill(title);
    await page.getByTestId('meeting-attendees').fill('Alice, Bob');
    await page.getByTestId('meeting-agenda').fill('Review roadmap.');

    await page.getByRole('button', { name: 'Add meeting' }).click();

    const list = page.getByTestId('meeting-list');
    await expect(list.getByText(title)).toBeVisible();
    await expect(list.getByText('Alice, Bob')).toBeVisible();

    const card = list.getByTestId(`meeting-card-${title}`);
    await card.getByTestId(/^meeting-prep-/).click();

    await expect(card.getByText('Prep notes')).toBeVisible();
  });
});
