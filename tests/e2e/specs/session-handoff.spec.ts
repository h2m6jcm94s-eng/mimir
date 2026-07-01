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

    // Capture the session id so device B can explicitly resume it. Tests share
    // the isolated test tenant, so the auto-loaded session on device B may not
    // be this one if other specs created sessions concurrently.
    const sessionLabel = await pageA
      .getByRole('button', { name: /^Session [a-f0-9]{8}$/ })
      .textContent();
    const sessionId = sessionLabel?.replace('Session ', '').trim() ?? '';

    const inputA = pageA.getByPlaceholder('Ask Mimir anything...');
    await inputA.fill('hello from device A');
    await pageA.getByRole('button', { name: 'Send' }).click();
    await expect(pageA.getByText('hello from device A', { exact: true })).toBeVisible();
    await expect(pageA.getByTestId('assistant-message')).toBeVisible({ timeout: 35000 });

    // Open device B and resume the same session from the active sessions list.
    const pageB = await context.newPage();
    await pageB.goto('/');
    await pageB.getByRole('button', { name: /Session/ }).click();
    await pageB.getByRole('button', { name: new RegExp(`^Session ${sessionId} `) }).click();
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
