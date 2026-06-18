import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

test.describe('Scheduling', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/scheduling');
    await expect(page.getByRole('heading', { name: 'Scheduling', level: 2 })).toBeVisible();
  });

  test('loads tabs and creates a project, resource, assignment and utilization', async ({
    page,
  }) => {
    const projectName = `Project ${Date.now()}`;
    await page.getByTestId('scheduling-project-name').fill(projectName);
    await page.getByTestId('scheduling-project-client').fill('Acme');
    await page.getByTestId('scheduling-project-status').selectOption('active');
    await page.getByTestId('scheduling-project-hours').fill('40');
    await page.getByTestId('scheduling-add-project').click();
    await expect(page.getByTestId('scheduling-project-row').getByText(projectName)).toBeVisible();

    await page.getByTestId('scheduling-tab-resources').click();
    const resourceName = `Resource ${Date.now()}`;
    await page.getByTestId('scheduling-resource-name').fill(resourceName);
    await page.getByTestId('scheduling-resource-role').fill('Engineer');
    await page.getByTestId('scheduling-resource-capacity').fill('40');
    await page.getByTestId('scheduling-add-resource').click();
    await expect(page.getByTestId('scheduling-resource-row').getByText(resourceName)).toBeVisible();

    await page.getByTestId('scheduling-tab-schedule').click();
    await page.getByTestId('scheduling-assignment-project').selectOption(projectName);
    await page.getByTestId('scheduling-assignment-resource').selectOption(resourceName);
    await page.getByTestId('scheduling-assignment-hours').fill('20');
    await page.getByTestId('scheduling-add-assignment').click();
    await expect(
      page.getByTestId('scheduling-assignment-row').getByText(projectName)
    ).toBeVisible();
    await expect(page.getByTestId('scheduling-assignment-row').getByText('20 h')).toBeVisible();

    await page.getByTestId('scheduling-tab-utilization').click();
    await expect(page.getByTestId('scheduling-util-row').getByText(resourceName)).toBeVisible();
    await expect(page.getByTestId('scheduling-util-row').getByText('40 h')).toBeVisible();
    await expect(page.getByTestId('scheduling-util-row').getByText('20 h').first()).toBeVisible();
  });
});
