import { expect, test } from '@playwright/test';

/**
 * Theme switcher tests.
 */
test.describe('Theme', () => {
  test('user can switch between light, dark, and liquid gold themes', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', { name: 'Dark' }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('button', { name: 'Liquid Gold' }).click();
    await expect(html).toHaveAttribute('data-theme', 'variant-b');

    await page.getByRole('button', { name: 'Light' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
  });
});
