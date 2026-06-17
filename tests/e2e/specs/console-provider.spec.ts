import path from 'node:path';
import { expect, test } from '@playwright/test';
import { signInAsTestUser } from '../fixtures/auth';

/**
 * Console end-to-end smoke test.
 *
 * This test is provider-agnostic: it verifies that a prompt submitted through
 * the console creates a task, streams to completion, and produces an assistant
 * response. When no real API keys are configured the API falls back to the
 * local stub provider, so the test passes in keyless CI as well as against live
 * providers.
 */
test('console routes a prompt through the configured provider and returns a response', async ({
  page,
  context,
}) => {
  await signInAsTestUser(context);
  await page.goto('/console');

  const prompt = 'Reply with exactly the word "pong".';
  await page.getByPlaceholder('Ask Mimir anything...').fill(prompt);
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText('Mimir is thinking…')).toBeVisible();
  await expect(page.getByText('Mimir is thinking…')).toBeHidden({ timeout: 30000 });

  // Wait for an actual assistant answer (not the user's own message).
  const answer = page.getByTestId('assistant-message').last();
  await expect(answer).toContainText(/pong|processed/i, { timeout: 60000 });

  await page.screenshot({ path: path.resolve(__dirname, '../results/console-provider.png') });
});
