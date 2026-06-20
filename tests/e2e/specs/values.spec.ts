import { signInAsTestUser } from '../fixtures/auth';
import { apiRequestHeaders, expect, test } from '../fixtures/base';

interface CreatedValue {
  id: string;
  name: string;
}

test.describe.configure({ mode: 'serial' });

test.describe('Values & decisions', () => {
  test.beforeEach(async ({ page, context, apiRequest }) => {
    await signInAsTestUser(context);

    const listResponse = await apiRequest.get('/v1/values', { headers: apiRequestHeaders() });
    if (listResponse.ok()) {
      const list = (await listResponse.json()) as { data: CreatedValue[] };
      await Promise.all(
        list.data.map((v) =>
          apiRequest.delete(`/v1/values/${v.id}`, { headers: apiRequestHeaders() })
        )
      );
    }

    await page.goto('/values');
  });

  test('page loads and can create a value', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Values & decisions', level: 2 })).toBeVisible();
    await page.getByPlaceholder('e.g. Health, Family, Growth').fill('Health');
    await page.getByRole('button', { name: 'Add value' }).click();
    await expect(page.getByText('Health')).toBeVisible();
  });

  test('can log a decision and see it in the list', async ({ page }) => {
    await page.getByPlaceholder('e.g. Health, Family, Growth').fill('Family');
    await page.getByRole('button', { name: 'Add value' }).click();
    await expect(page.getByText('Family')).toBeVisible();

    await page.getByRole('button', { name: 'Decisions' }).click();
    await page.getByPlaceholder('What did you decide?').fill('Visit parents this weekend');
    await page.getByPlaceholder('Options (one per line)').fill('Visit parents\nStay home');
    await page.getByPlaceholder('Chosen option').fill('Visit parents');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Log decision' }).click();

    await expect(page.getByText('Visit parents this weekend')).toBeVisible();
    await expect(page.getByText('Chosen: Visit parents')).toBeVisible();
  });
});
