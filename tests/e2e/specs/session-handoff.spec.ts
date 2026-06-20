import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

/**
 * Cross-device session handoff tests.
 */
test.describe('Cross-device session handoff', () => {
  test.beforeEach(async ({ context }) => {
    await signInAsTestUser(context);
  });

  test('a session started on one device continues on another', async ({ context }) => {
    const pageA = await context.newPage();
    await pageA.goto('/');

    // Start a fresh session on device A.
    await pageA.getByRole('button', { name: /Session/ }).click();
    await pageA.getByRole('button', { name: 'New session' }).click();

    const inputA = pageA.getByPlaceholder('Ask Mimir anything...');
    await inputA.fill('hello from device A');
    await pageA.getByRole('button', { name: 'Send' }).click();
    await expect(pageA.getByText('hello from device A', { exact: true })).toBeVisible();
    await expect(pageA.getByTestId('assistant-message')).toBeVisible({ timeout: 35000 });

    // Open device B and verify the same conversation loads automatically.
    const pageB = await context.newPage();
    await pageB.goto('/');
    await expect(pageB.getByText('hello from device A', { exact: true })).toBeVisible({
      timeout: 10000,
    });

    // Reply from device B.
    const inputB = pageB.getByPlaceholder('Ask Mimir anything...');
    await inputB.fill('reply from device B');
    await pageB.getByRole('button', { name: 'Send' }).click();
    await expect(pageB.getByText('reply from device B', { exact: true })).toBeVisible();
    await expect(pageB.getByTestId('assistant-message')).toHaveCount(2, { timeout: 35000 });

    // Back on device A, a refresh shows device B's reply.
    await pageA.reload();
    await expect(pageA.getByText('reply from device B', { exact: true })).toBeVisible({
      timeout: 10000,
    });
  });
});
