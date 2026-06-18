import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

test.describe('Demo lockout', () => {
  test('lock screen renders and explains how to request access', async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/demo-locked');

    await expect(page.getByRole('heading', { name: 'Demo workspace locked' })).toBeVisible();
    await expect(page.getByText('Your demo period has ended.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request access' })).toBeVisible();
  });
});
