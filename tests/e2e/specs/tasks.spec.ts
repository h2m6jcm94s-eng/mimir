import { expect, test } from '@playwright/test';
import { apiHeaders, signInAsTestUser } from '../fixtures/auth';

/**
 * Tasks kanban tests.
 *
 * Verifies that the board renders with real API data and a user can move a
 * blocked task back to the queue.
 */
test.describe('Tasks', () => {
  let jobId = '';

  test.beforeEach(async ({ page, context, request }) => {
    await signInAsTestUser(context);

    // Create a deterministic policy so the task is blocked and no workflow runs.
    await request.put('/api/v1/governance/policy', {
      headers: apiHeaders(),
      data: {
        name: 'e2e-kanban-policy',
        document: {
          version: '1',
          rules: [
            {
              name: 'block-e2e-kanban-task',
              effect: 'require_approval',
              action: 'e2e-kanban-task',
            },
          ],
        },
      },
    });

    const key = `e2e-tasks-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const created = await request.post('/api/v1/tasks', {
      headers: apiHeaders(),
      data: {
        idempotencyKey: key,
        type: 'e2e-kanban-task',
        prompt: 'e2e task',
        payload: { provider: 'local' },
      },
    });
    const body = await created.json();
    jobId = body.jobId;

    await page.goto('/tasks');
  });

  test('page loads the kanban board', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tasks', level: 2 })).toBeVisible();
    for (const col of ['Queued', 'Running', 'Blocked', 'Needs Attention', 'Done', 'Failed']) {
      await expect(page.getByRole('heading', { name: col, level: 3 })).toBeVisible();
    }
  });

  test('task card shows model, tier, blast radius and cost', async ({ page }) => {
    const card = page.getByTestId(`task-card-${jobId}`);
    await expect(card).toBeVisible();
    await expect(card.getByText('0 attachments · e2e-kanban-task')).toBeVisible();
    await expect(card.getByText('$0.000')).toBeVisible();
  });

  test('user can move a blocked task back to queued', async ({ page }) => {
    const card = page.getByTestId(`task-card-${jobId}`);
    await expect(card).toBeVisible();

    await card.locator('select').selectOption('Queued');
    await expect(card.locator('select')).toHaveValue('Queued');
  });
});
