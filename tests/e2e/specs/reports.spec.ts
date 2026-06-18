import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

/**
 * Reports page tests.
 */
test.describe('Reports', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/reports');
  });

  test('page loads with report cards and usage insights', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Reports', level: 2 })).toBeVisible();
    await expect(page.getByText('Usage insights')).toBeVisible();
    await expect(page.getByText('Tasks completed')).toBeVisible();
    await expect(page.getByText('Time saved')).toBeVisible();
    await expect(page.getByText('Automation rate')).toBeVisible();
    await expect(page.getByText('Security Audit')).toBeVisible();
    await expect(page.getByText('Weekly Cost Report')).toBeVisible();
  });

  test('kind filters show only matching reports', async ({ page }) => {
    await page.getByTestId('report-filters').getByRole('button', { name: 'Cost' }).click();
    await expect(page.getByText('Weekly Cost Report')).toBeVisible();
    await expect(page.getByText('Security Audit')).not.toBeVisible();
  });

  test('search narrows results', async ({ page }) => {
    await page.locator('input[placeholder="Search reports"]').fill('compliance');
    await expect(page.getByText('Q2 Compliance Summary')).toBeVisible();
    await expect(page.getByText('Security Audit')).not.toBeVisible();
  });

  test('generating report has disabled download', async ({ page }) => {
    const mesh = page.getByTestId('report-mesh-health');
    await expect(mesh.getByTestId('report-status')).toHaveText('generating');
    await expect(mesh.getByRole('button', { name: 'Download' })).toBeDisabled();
  });
});
