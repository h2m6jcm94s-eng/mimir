import { signInAsTestUser } from '../fixtures/auth';
import { apiRequestHeaders, expect, test } from '../fixtures/base';

interface CreatedRoutine {
  id: string;
  name: string;
}

/**
 * Routines page tests.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Routines', () => {
  let morningBrief: CreatedRoutine;
  let dependencyAudit: CreatedRoutine;
  let standupPrep: CreatedRoutine;
  let weeklyReport: CreatedRoutine;

  test.beforeEach(async ({ page, context, apiRequest }) => {
    await signInAsTestUser(context);

    // Clean up routines left by previous tests in the shared tenant.
    const listResponse = await apiRequest.get('/v1/routines', { headers: apiRequestHeaders() });
    if (listResponse.ok()) {
      const list = (await listResponse.json()) as { data: CreatedRoutine[] };
      await Promise.all(
        list.data.map((r) =>
          apiRequest.delete(`/v1/routines/${r.id}`, { headers: apiRequestHeaders() })
        )
      );
    }

    const create = async (body: Record<string, unknown>): Promise<CreatedRoutine> => {
      const response = await apiRequest.post('/v1/routines', {
        data: body,
        headers: apiRequestHeaders(),
      });
      if (!response.ok()) {
        throw new Error(`Failed to create routine: ${await response.text()}`);
      }
      const json = (await response.json()) as { data: CreatedRoutine };
      return json.data;
    };

    [morningBrief, dependencyAudit, standupPrep, weeklyReport] = await Promise.all([
      create({
        name: 'Morning Brief',
        description: 'Daily morning summary',
        cron: '0 8 * * *',
        jobType: 'capture',
        jobInput: {},
        tier: 0,
        enabled: true,
      }),
      create({
        name: 'Dependency Audit',
        description: 'Weekly dependency review',
        cron: '0 9 * * 1',
        jobType: 'audit',
        jobInput: {},
        tier: 0,
        enabled: true,
      }),
      create({
        name: 'Standup Prep',
        description: 'Manual standup notes',
        jobType: 'standup',
        jobInput: {},
        tier: 0,
        enabled: true,
      }),
      create({
        name: 'Weekly Report',
        description: 'End of week report',
        cron: '0 17 * * 5',
        jobType: 'report',
        jobInput: {},
        tier: 0,
        enabled: false,
      }),
    ]);

    await page.goto('/routines');
  });

  test('page loads with routines list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Routines', level: 2 })).toBeVisible();
    await expect(page.getByText('Morning Brief')).toBeVisible();
    await expect(page.getByText('Dependency Audit')).toBeVisible();
  });

  test('trigger filters show only matching routines', async ({ page }) => {
    await page.getByRole('button', { name: 'Manual' }).click();
    await expect(page.getByText('Standup Prep')).toBeVisible();
    await expect(page.getByText('Morning Brief')).not.toBeVisible();
  });

  test('search narrows results', async ({ page }) => {
    await page.locator('input[placeholder="Search routines"]').fill('report');
    await expect(page.getByText('Weekly Report')).toBeVisible();
    await expect(page.getByText('Morning Brief')).not.toBeVisible();
  });

  test('enable toggle changes routine status', async ({ page }) => {
    const weekly = page.getByTestId(`routine-${weeklyReport.id}`);
    await expect(weekly.getByTestId('routine-status')).toHaveText('Disabled');
    await weekly.getByTestId('routine-toggle').click();
    await expect(weekly.getByTestId('routine-status')).toHaveText('Enabled');
  });

  test('run now updates last run text', async ({ page }) => {
    const weekly = page.getByTestId(`routine-${weeklyReport.id}`);
    await expect(weekly.getByTestId('routine-last-run')).toContainText('Never');
    await weekly.getByTestId('routine-run').click();
    await expect(weekly.getByTestId('routine-last-run')).toContainText('Just now');
  });
});
