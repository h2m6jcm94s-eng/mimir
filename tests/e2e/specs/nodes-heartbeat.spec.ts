import { apiRequestHeaders, expect, test } from '../fixtures/base';

/**
 * F-056 mesh discovery end-to-end test.
 *
 * A real user would enroll a node and watch its status update as heartbeats arrive.
 * We call the API as the UI would and verify the heartbeat updates lastSeen.
 */
test.describe('Node heartbeat', () => {
  test('enrolling a node and sending a heartbeat updates status', async ({ apiRequest }) => {
    const externalId = `e2e-node-${Date.now()}`;

    const enrollResponse = await apiRequest.post('/v1/nodes/enroll', {
      headers: apiRequestHeaders(),
      data: {
        kind: 'desktop',
        name: 'e2e-desktop',
        tier: 1,
        tailnetAddr: '100.64.0.2',
      },
    });
    expect(enrollResponse.status()).toBe(201);
    const { id: nodeId } = await enrollResponse.json();

    const beforeResponse = await apiRequest.get(`/v1/nodes/${nodeId}`, {
      headers: apiRequestHeaders(),
    });
    expect(beforeResponse.status()).toBe(200);
    const before = await beforeResponse.json();

    const heartbeatResponse = await apiRequest.post(`/v1/nodes/${nodeId}/heartbeat`, {
      headers: apiRequestHeaders(),
      data: { status: 'up' },
    });
    expect(heartbeatResponse.status()).toBe(200);
    const heartbeat = await heartbeatResponse.json();
    expect(heartbeat.status).toBe('up');

    const afterResponse = await apiRequest.get(`/v1/nodes/${nodeId}`, {
      headers: apiRequestHeaders(),
    });
    expect(afterResponse.status()).toBe(200);
    const after = await afterResponse.json();
    expect(new Date(after.lastSeen).getTime()).toBeGreaterThan(new Date(before.lastSeen).getTime());
  });
});
