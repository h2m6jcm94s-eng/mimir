import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

/**
 * Accessibility assistant page tests.
 *
 * Verifies the text-to-speech, simplification, and display-adjustment surface.
 */
test.describe('Accessibility', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/accessibility');
  });

  test('page loads with controls', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Accessibility', level: 2 })).toBeVisible();
    await expect(page.getByTestId('accessibility-text-input')).toBeVisible();
    await expect(page.getByTestId('speak-button')).toBeVisible();
    await expect(page.getByText('Display settings')).toBeVisible();
  });

  test('typing updates preview and simplified text', async ({ page }) => {
    const input = page.getByTestId('accessibility-text-input');
    await input.fill('Mimir is built to help humans.');
    await expect(page.getByTestId('accessibility-preview')).toContainText(
      'Mimir is built to help humans.'
    );
    await expect(page.getByText('Mimir is made to help humans.')).toBeVisible();
  });

  test('font size buttons change the displayed size', async ({ page }) => {
    const increase = page.getByRole('button', { name: 'Increase font size' });
    await increase.click();
    await expect(page.getByText('17px')).toBeVisible();
  });
});
