import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

test.describe('Skill builder', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/skills/builder');
  });

  test('generates a skill draft from a prompt', async ({ page }) => {
    await page.getByTestId('skill-prompt').fill('A skill that summarizes my unread emails');
    await page.getByTestId('skill-generate').click();

    await expect(page.getByTestId('skill-generated-code')).toBeVisible();
    await expect(page.getByTestId('skill-draft-status')).toHaveText('draft');
  });
});
