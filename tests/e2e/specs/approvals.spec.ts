import { expect, test } from '@playwright/test';
import { apiHeaders, signInAsTestUser } from '../fixtures/auth';

/**
 * Approvals inbox tests.
 *
 * Verifies that the approvals page loads pending approvals from the API and
 * that a user can approve or deny them.
 */
test.describe('Approvals', () => {
  test.beforeEach(async ({ page, context, request }) => {
    await signInAsTestUser(context);

    // Seed a policy so creating this task produces a pending approval.
    const policyRes = await request.put('/api/v1/governance/policy', {
      headers: apiHeaders(),
      data: {
        name: 'e2e-approvals-policy',
        source:
          'rules:\n  - name: require-approval-e2e\n    effect: require_approval\n    action: approval-e2e\n',
      },
    });
    expect(policyRes.ok()).toBeTruthy();
  });

  test('page loads with pending approvals', async ({ page, request }) => {
    const taskRes = await request.post('/api/v1/tasks', {
      headers: apiHeaders(),
      data: {
        idempotencyKey: `e2e-approval-load-${Date.now()}`,
        type: 'approval-e2e',
        prompt: 'approval test',
        payload: {},
      },
    });
    expect(taskRes.ok()).toBeTruthy();
    const { approvalId } = (await taskRes.json()) as { approvalId: string };

    await page.goto('/approvals');

    await expect(page.getByRole('heading', { name: 'Approvals', level: 2 })).toBeVisible();
    const card = page.locator(`[data-testid="approval-${approvalId}"]`);
    await expect(card).toBeVisible();
    await expect(card.getByText('pending')).toBeVisible();
  });

  test('user can approve and see it in history', async ({ page, request }) => {
    const taskRes = await request.post('/api/v1/tasks', {
      headers: apiHeaders(),
      data: {
        idempotencyKey: `e2e-approval-approve-${Date.now()}`,
        type: 'approval-e2e',
        prompt: 'approval test',
        payload: {},
      },
    });
    expect(taskRes.ok()).toBeTruthy();
    const { approvalId } = (await taskRes.json()) as { approvalId: string };

    await page.goto('/approvals');

    const card = page.locator(`[data-testid="approval-${approvalId}"]`);
    await expect(card).toBeVisible();

    await card.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(card).not.toBeVisible();

    await page.getByRole('button', { name: 'Approved' }).click();
    await expect(card.getByText(/approved/i)).toBeVisible();
  });

  test('user can deny and see it in history', async ({ page, request }) => {
    const taskRes = await request.post('/api/v1/tasks', {
      headers: apiHeaders(),
      data: {
        idempotencyKey: `e2e-approval-deny-${Date.now()}`,
        type: 'approval-e2e',
        prompt: 'approval test',
        payload: {},
      },
    });
    expect(taskRes.ok()).toBeTruthy();
    const { approvalId } = (await taskRes.json()) as { approvalId: string };

    await page.goto('/approvals');

    const card = page.locator(`[data-testid="approval-${approvalId}"]`);
    await expect(card).toBeVisible();

    await card.getByRole('button', { name: 'Deny' }).click();
    await expect(card).not.toBeVisible();

    await page.getByRole('button', { name: 'Denied' }).click();
    await expect(card.getByText(/denied/i)).toBeVisible();
  });
});
