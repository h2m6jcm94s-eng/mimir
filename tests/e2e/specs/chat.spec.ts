import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

test.describe('Encrypted chat', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/chat');
  });

  test('creates an encrypted channel and sends a message', async ({ page }) => {
    const title = `Secret ${Date.now()}`;
    const message = 'Hello from the other side';

    await page.getByTestId('chat-channel-title').fill(title);
    await page.getByTestId('chat-channel-passphrase').fill('super-secret-passphrase');
    await page.getByTestId('chat-create-channel').click();

    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    await page.getByTestId('chat-message-input').fill(message);
    await page.getByTestId('chat-send-message').click();

    await expect(
      page.getByTestId('chat-decrypted-message').filter({ hasText: message })
    ).toBeVisible();
  });
});
