import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

test.describe('Self-healing remediation', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/remediation');
  });

  test('creates a remediation run from the form', async ({ page }) => {
    await page.getByTestId('remediation-target-type').fill('service');
    await page.getByTestId('remediation-target-id').fill('e2e-test-service');
    await page.getByTestId('remediation-issue').fill('The service is returning 500 errors.');
    await page.getByTestId('remediation-run').click();

    await expect(page.getByTestId('remediation-detail-status')).toHaveText('resolved');
    await expect(page.getByTestId('remediation-action')).toBeVisible();

    const listItem = page
      .locator('[data-testid="remediation-run-list"]')
      .getByText('service: e2e-test-service');
    await expect(listItem).toBeVisible();
  });
});
