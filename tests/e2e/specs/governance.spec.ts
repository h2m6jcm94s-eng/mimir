import { expect, test } from '@playwright/test';
import { apiHeaders, signInAsTestUser } from '../fixtures/auth';

/**
 * Governance page tests.
 */
test.describe('Governance', () => {
  test.beforeEach(async ({ page, context, request }) => {
    await signInAsTestUser(context);

    // Ensure a valid YAML policy is active so the editor always starts valid.
    const res = await request.put('/api/v1/governance/policy', {
      headers: apiHeaders(),
      data: {
        name: 'e2e-governance-policy',
        source: 'rules:\n  - name: allow-all\n    effect: allow\n',
      },
    });
    expect(res.ok()).toBeTruthy();

    await page.goto('/governance');
  });

  test('policy tab shows YAML editor and validation badge', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Governance', level: 2 })).toBeVisible();
    await expect(page.getByText('Valid YAML')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('invalid YAML shows error badge', async ({ page }) => {
    await page.locator('textarea').fill('invalid content');
    await expect(page.getByTestId('policy-invalid')).toBeVisible();
  });

  test('natural-language mode translates a description to YAML', async ({ page }) => {
    await page.getByTestId('governance-mode-natural').click();
    await page.getByTestId('governance-natural-input').fill('Require approval for github.openPr');
    await page.getByTestId('governance-translate').click();

    await expect(page.getByTestId('governance-yaml-input')).toBeVisible();
    await expect(page.getByTestId('governance-yaml-input')).toHaveValue(/action: "github\.openPr"/);
    await expect(page.getByTestId('governance-yaml-input')).toHaveValue(/effect: require_approval/);
    await expect(page.getByTestId('policy-valid')).toBeVisible();
    await expect(page.getByTestId('governance-explanations')).toContainText(
      'Require approval for github.openPr'
    );
  });

  test('one-click save persists a translated draft', async ({ page }) => {
    await page.getByTestId('governance-mode-natural').click();
    await page.getByTestId('governance-natural-input').fill('Allow all');
    await page.getByTestId('governance-translate-save').click();

    await expect(page.getByTestId('governance-yaml-input')).toBeVisible();
    await expect(page.getByTestId('governance-yaml-input')).toHaveValue(/effect: allow/);
    await expect(page.getByText('Saved')).toBeVisible();
  });

  test('audit log tab renders hash-chain table', async ({ page }) => {
    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(page.getByRole('button', { name: 'Verify chain' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
  });

  test('verify chain button refreshes audit verification status', async ({ page }) => {
    await page.getByRole('button', { name: 'Audit Log' }).click();
    await page.getByTestId('verify-chain').click();
    await expect(page.getByText('Verified').or(page.getByText('Chain broken'))).toBeVisible();
  });

  test('privacy flow map renders', async ({ page }) => {
    await page.getByRole('button', { name: 'Privacy Flow' }).click();
    await expect(page.getByRole('heading', { name: 'Privacy flow map' })).toBeVisible();
    await expect(page.getByLabel('Privacy flow diagram').getByText('Classifier')).toBeVisible();
    await expect(page.getByLabel('Privacy flow diagram').getByText('Policy')).toBeVisible();
  });
});
