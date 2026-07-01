import { expect, test } from '@playwright/test';
import { apiHeaders, signInAsTestUser } from '../fixtures/auth';

/**
 * Tools page end-to-end tests.
 *
 * These tests exercise the no-code tool builder UI: listing tools, creating a
 * tool with input fields, and invoking the runner. The runner is expected to
 * fail at the connector layer because no GitHub connector is configured in the
 * isolated test tenant; this still validates that the full web -> API -> engine
 * -> connector path is wired correctly.
 *
 * The describe block is serial because the tests share the test tenant and the
 * runner test builds on the list state created by the create test.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Tools', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/tools');
  });

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup so subsequent spec runs start tidy.
    const listRes = await request.get('/api/v1/tools', { headers: apiHeaders() });
    if (listRes.ok()) {
      const body = (await listRes.json()) as { data: Array<{ id: string }> };
      for (const tool of body.data) {
        await request.delete(`/api/v1/tools/${tool.id}`, { headers: apiHeaders() });
      }
    }
  });

  test('lists the tools page and builder form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tools', level: 2 })).toBeVisible();
    await expect(page.getByTestId('tool-name-input')).toBeVisible();
    await expect(page.getByTestId('tool-action-select')).toBeVisible();
    await expect(page.getByTestId('tool-save')).toBeVisible();
  });

  test('creates a tool and displays it in the list', async ({ page }) => {
    await page.getByTestId('tool-name-input').fill('List repos');
    await page.getByTestId('tool-description-input').fill('List GitHub repositories');
    await page.getByTestId('tool-action-select').selectOption('github.listRepos');

    await page.getByTestId('tool-add-field').click();
    await page.getByTestId('tool-field-name-0').fill('perPage');
    await page.getByTestId('tool-field-label-0').fill('Per page');
    await page.getByTestId('tool-field-type-0').selectOption('number');

    await page.getByTestId('tool-save').click();

    const card = page.locator('[data-testid^="tool-card-"]', { hasText: 'List repos' }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText('List repos');
    await expect(card).toContainText('List GitHub repositories');
  });

  test('runs a tool and surfaces connector errors', async ({ page }) => {
    await page.getByTestId('tool-name-input').fill('Run test');
    await page.getByTestId('tool-action-select').selectOption('github.listRepos');

    await page.getByTestId('tool-add-field').click();
    await page.getByTestId('tool-field-name-0').fill('perPage');
    await page.getByTestId('tool-field-label-0').fill('Per page');
    await page.getByTestId('tool-field-type-0').selectOption('number');

    await page.getByTestId('tool-save').click();

    const card = page.locator('[data-testid^="tool-card-"]', { hasText: 'Run test' }).first();
    await expect(card).toBeVisible();

    await card.getByRole('button', { name: 'Run' }).click();

    await expect(
      card.getByText(/Connector action failed|token not found|Connector not found/i)
    ).toBeVisible();
  });
});
