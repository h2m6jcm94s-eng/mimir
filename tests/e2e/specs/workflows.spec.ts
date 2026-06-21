import { signInAsTestUser } from '../fixtures/auth';
import { apiRequestHeaders, expect, test } from '../fixtures/base';

interface WorkflowItem {
  id: string;
  name: string;
}

/**
 * Workflows page tests.
 */
test.describe.configure({ mode: 'serial' });

test.describe('Workflows', () => {
  test.beforeEach(async ({ page, context, apiRequest }) => {
    await signInAsTestUser(context);

    const listResponse = await apiRequest.get('/v1/workflows', { headers: apiRequestHeaders() });
    if (listResponse.ok()) {
      const list = (await listResponse.json()) as { data: WorkflowItem[] };
      await Promise.all(
        list.data.map((wf) =>
          apiRequest.delete(`/v1/workflows/${wf.id}`, { headers: apiRequestHeaders() })
        )
      );
    }

    await page.goto('/workflows');
  });

  test('page loads with empty state', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Workflows', level: 2 })).toBeVisible();
    await expect(page.getByText('No workflows yet.')).toBeVisible();
  });

  test('generates a workflow from a description', async ({ page }) => {
    await page
      .getByPlaceholder('Describe what you want to automate...')
      .fill('Send a slack message every morning');
    await page.getByRole('button', { name: 'Generate' }).click();

    await expect(page.getByText('Generated: Send a slack message every morning')).toBeVisible();
    await expect(page.getByText('Draft')).toBeVisible();
  });

  test('imports an n8n workflow', async ({ page }) => {
    const n8nJson = JSON.stringify({
      name: 'Daily Telegram',
      nodes: [
        {
          name: 'Every day',
          type: 'n8n-nodes-base.scheduleTrigger',
          parameters: { rule: { interval: 1, unit: 'days' } },
          position: [100, 200],
        },
        {
          name: 'Send Telegram',
          type: 'n8n-nodes-base.telegram',
          parameters: { chatId: '123', text: 'Hello' },
          position: [300, 200],
        },
      ],
      connections: {
        'Every day': {
          main: [[{ node: 'Send Telegram', type: 'main', index: 0 }]],
        },
      },
    });

    await page.getByPlaceholder('Paste exported n8n JSON here').fill(n8nJson);
    await page.getByRole('button', { name: 'Import' }).click();

    await expect(page.getByText('Daily Telegram')).toBeVisible();
  });

  test('assigns a workflow to a node and shows the assignment', async ({ page, apiRequest }) => {
    // Enroll a node so it can be assigned.
    const nodeResponse = await apiRequest.post('/v1/nodes/enroll', {
      data: { kind: 'desktop', name: 'Test Desktop', tier: 1 },
      headers: apiRequestHeaders(),
    });
    if (!nodeResponse.ok()) {
      throw new Error(`Failed to enroll node: ${await nodeResponse.text()}`);
    }
    const node = (await nodeResponse.json()) as { id: string; name: string };

    // Create a workflow via the API so we can reliably target it.
    const workflowResponse = await apiRequest.post('/v1/workflows/import/n8n', {
      data: {
        name: 'Node-bound workflow',
        description: 'Bound to a device',
        n8nWorkflowJson: {
          name: 'Node-bound workflow',
          nodes: [
            {
              name: 'Every day',
              type: 'n8n-nodes-base.scheduleTrigger',
              parameters: { rule: { interval: 1, unit: 'days' } },
              position: [100, 200],
            },
          ],
          connections: {},
        },
      },
      headers: apiRequestHeaders(),
    });
    if (!workflowResponse.ok()) {
      throw new Error(`Failed to create workflow: ${await workflowResponse.text()}`);
    }
    const workflow = (await workflowResponse.json()) as { data: WorkflowItem };

    await page.reload();
    await page.getByText('Node-bound workflow').click();

    // Assign the node in the UI.
    await page.getByRole('combobox').first().selectOption(node.id);
    await expect(page.getByText('Assigned node:')).toBeVisible();
    await expect(page.getByText('Test Desktop').first()).toBeVisible();

    // The node assignment panel also reflects the binding.
    await expect(page.getByText('1 workflow')).toBeVisible();
  });
});
