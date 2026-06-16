import { expect, test } from '@playwright/test';

/**
 * Settings page tests.
 */
test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('page loads with settings tabs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Appearance' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'API Keys' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Members' })).toBeVisible();
  });

  test('switching tabs shows the right panel', async ({ page }) => {
    await page.getByRole('button', { name: 'API Keys' }).click();
    await expect(page.getByTestId('api-key')).toBeVisible();
    await page.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByTestId('toggle-approvals')).toBeVisible();
  });

  test('regenerate key updates the API key', async ({ page }) => {
    await page.getByRole('button', { name: 'API Keys' }).click();
    const before = await page.getByTestId('api-key').inputValue();
    await page.getByTestId('regenerate-key').click();
    const after = await page.getByTestId('api-key').inputValue();
    expect(after).not.toBe(before);
  });

  test('notification toggle changes state', async ({ page }) => {
    await page.getByRole('button', { name: 'Notifications' }).click();
    const toggle = page.getByTestId('toggle-marketing');
    const initial = await toggle.getAttribute('aria-pressed');
    await toggle.click();
    const next = await toggle.getAttribute('aria-pressed');
    expect(next).not.toBe(initial);
  });

  test('members tab lists workspace members', async ({ page }) => {
    await page.getByRole('button', { name: 'Members' }).click();
    await expect(page.getByText('Alex Chen')).toBeVisible();
    await expect(page.getByText('Sam Doe')).toBeVisible();
  });
});
