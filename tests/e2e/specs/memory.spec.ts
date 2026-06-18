import { signInAsTestUser } from '../fixtures/auth';
import { apiRequestHeaders, expect, test } from '../fixtures/base';

/**
 * Memory page tests.
 *
 * Seeds graph nodes and checkpoints per run so the time-machine and graph views
 * have deterministic data to render.
 */
test.describe('Memory', () => {
  // Run these tests sequentially so the shared seeded checkpoint/node pair is
  // created exactly once per spec file.
  test.describe.configure({ mode: 'serial' });

  const runId = Date.now().toString();
  const nodeKey = `e2e-memory-node-${runId}`;
  const baselineLabel = `Security brief absorbed ${runId}`;
  const currentLabel = `Current ${runId}`;

  test.beforeAll(async ({ apiRequest }) => {
    // Seed a memory node so the graph tab renders ReactFlow.
    const nodeRes = await apiRequest.post('/v1/memory/nodes', {
      headers: apiRequestHeaders(),
      data: { kind: 'semantic', key: nodeKey, value: { e2e: true } },
    });
    expect(nodeRes.status()).toBe(201);
    const node = (await nodeRes.json()).data;

    // Capture an older checkpoint.
    const baseRes = await apiRequest.post('/v1/memory/checkpoints', {
      headers: apiRequestHeaders(),
      data: { label: baselineLabel },
    });
    expect(baseRes.status()).toBe(201);

    // Mutate the graph so the next checkpoint differs.
    const updatedRes = await apiRequest.patch(`/v1/memory/nodes/${node.id}`, {
      headers: apiRequestHeaders(),
      data: { value: { e2e: true, updated: true } },
    });
    expect(updatedRes.status()).toBe(200);

    // Capture the current checkpoint.
    const currentRes = await apiRequest.post('/v1/memory/checkpoints', {
      headers: apiRequestHeaders(),
      data: { label: currentLabel },
    });
    expect(currentRes.status()).toBe(201);
  });

  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/memory');
  });

  test('page loads with time machine', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Memory', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Time Machine' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Current/ })).toBeVisible();
  });

  test('user can switch to graph memory', async ({ page }) => {
    await page.getByRole('button', { name: 'Graph Memory' }).click();
    await expect(page.locator('.react-flow')).toBeVisible();
  });

  test('hovering a checkpoint updates diff view', async ({ page }) => {
    await page.getByText(baselineLabel).first().hover();
    await expect(page.getByText(`${baselineLabel} → ${currentLabel}`)).toBeVisible();
  });

  test('rewind, restore, and branch buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Rewind' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Branch' })).toBeVisible();
  });
});
