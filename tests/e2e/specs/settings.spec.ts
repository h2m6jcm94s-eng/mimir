import http from 'node:http';
import { signInAsTestUser } from '../fixtures/auth';
import { apiRequestHeaders, expect, test } from '../fixtures/base';

function startMockOllama(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/api/tags' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            models: [{ name: 'llama3.1:latest' }, { name: 'nomic-embed-text:latest' }],
          })
        );
        return;
      }
      if (req.url === '/api/pull' && req.method === 'POST') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
        return;
      }
      res.writeHead(404);
      res.end('not found');
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Invalid server address'));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
    server.on('error', reject);
  });
}

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

  test('security tab shows PIN status and change form', async ({ page }) => {
    await page.getByRole('button', { name: 'Security' }).click();
    await expect(page.getByText('Approval PIN')).toBeVisible();
    await expect(page.getByTestId('pin-status')).toHaveText('Set');
    await expect(page.getByTestId('current-pin-input')).toBeVisible();
    await expect(page.getByTestId('new-pin-input')).toBeVisible();
    await expect(page.getByTestId('confirm-pin-input')).toBeVisible();
  });

  test('budget tab loads and saves budget limits', async ({ page }) => {
    await page.getByRole('button', { name: 'Budget' }).click();
    await expect(page.getByText('Budget limits')).toBeVisible();
    await expect(page.getByTestId('daily-budget-input')).toBeVisible();

    await page.getByTestId('daily-budget-input').fill('2500');
    await page.getByTestId('monthly-budget-input').fill('10000');
    await page.getByTestId('save-budget').click();
    await expect(page.getByTestId('save-budget')).toHaveText('Save budget');
  });

  test('local models tab loads and shows offline status by default', async ({ page }) => {
    await page.getByRole('button', { name: 'Mimir Local' }).click();
    await expect(page.getByRole('heading', { name: 'Mimir Local runtime' })).toBeVisible();
    await expect(page.getByText('Offline')).toBeVisible();
  });

  test('local models tab saves config and probes mocked Ollama', async ({ page, apiRequest }) => {
    const mock = await startMockOllama();
    try {
      await page.getByRole('button', { name: 'Mimir Local' }).click();
      await expect(page.getByLabel('Local runtime base URL')).toBeVisible();

      await page.getByLabel('Local runtime base URL').fill(mock.baseUrl);
      await page.getByLabel('Mimir chat model').fill('llama3.1');
      await page.getByLabel('Mimir embedding model').fill('nomic-embed-text');
      await page.getByRole('button', { name: 'Save local model config' }).click();

      await expect(page.getByText('Online')).toBeVisible();
      await expect(page.getByText('llama3.1:latest')).toBeVisible();
      await expect(page.getByText('nomic-embed-text:latest')).toBeVisible();

      // Verify the config round-tripped through the real API.
      const configResponse = await apiRequest.get('/v1/models/local/config', {
        headers: apiRequestHeaders(),
      });
      expect(configResponse.status()).toBe(200);
      const { data: config } = await configResponse.json();
      expect(config.baseUrl).toBe(mock.baseUrl);
      expect(config.chatModel).toBe('llama3.1');
    } finally {
      await mock.close();
    }
  });
});
