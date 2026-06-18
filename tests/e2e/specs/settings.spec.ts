import { signInAsTestUser } from '../fixtures/auth';
import { apiRequestHeaders, expect, test } from '../fixtures/base';

/**
 * Settings page tests.
 */
test.describe('Settings', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/settings');
  });

  test('page loads with settings tabs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'General' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Appearance' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'API Keys' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nodes' })).toBeVisible();
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

  test('nodes tab lists enrolled mesh nodes', async ({ page, apiRequest }) => {
    const externalId = `settings-node-${Date.now()}`;
    const enrollResponse = await apiRequest.post('/v1/nodes/enroll', {
      headers: apiRequestHeaders(),
      data: {
        kind: 'desktop',
        name: externalId,
        tier: 1,
        tailnetAddr: '100.64.0.5',
      },
    });
    expect(enrollResponse.status()).toBe(201);
    const { id: nodeId } = await enrollResponse.json();

    await page.getByRole('button', { name: 'Nodes' }).click();
    await expect(page.getByTestId(`node-card-${nodeId}`)).toBeVisible();
    await expect(page.getByTestId(`node-name-${nodeId}`)).toHaveText(externalId);
  });

  test('notifications tab lists system notifications and supports mark read', async ({
    page,
    apiRequest,
  }) => {
    const title = `Settings notification ${Date.now()}`;
    const createResponse = await apiRequest.post('/v1/notifications', {
      headers: apiRequestHeaders(),
      data: {
        kind: 'settings.test',
        title,
        body: 'Created from the settings e2e test.',
        priority: 'normal',
        channels: ['in_app'],
      },
    });
    expect(createResponse.status()).toBe(201);
    const { notification } = await createResponse.json();

    await page.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByTestId(`notification-card-${notification.id}`)).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();

    const markRead = page.getByTestId(`mark-read-${notification.id}`);
    await expect(markRead).toHaveText('Mark read');
    await markRead.click();
    await expect(markRead).toHaveText('Read');
  });
});
