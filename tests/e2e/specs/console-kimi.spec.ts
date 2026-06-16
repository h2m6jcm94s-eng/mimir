import { expect, test } from '@playwright/test';

test('console routes a prompt through Kimi and shows a real response', async ({ page }) => {
  await page.goto('/console');

  const prompt = 'Reply with exactly the word "pong".';
  await page.getByPlaceholder('Ask Mimir anything...').fill(prompt);
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText('Mimir is thinking…')).toBeVisible();
  await expect(page.getByText('Mimir is thinking…')).toBeHidden({ timeout: 30000 });

  // Wait for an assistant answer that came from the real provider, not the local stub.
  const answer = page.locator('div').filter({ hasText: /pong/i }).last();
  await expect(answer).toBeVisible({ timeout: 60000 });

  const text = await answer.textContent();
  expect(text).not.toContain('[local] processed');

  await page.screenshot({ path: 'tests/e2e/results/console-kimi.png' });
});
