import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createSandboxRunner } from '../services/sandbox';
import { buildTestApp } from '../test-helpers/build-app';
import { approvalRoutes } from './approvals';
import { sandboxRoutes } from './sandbox';

function hasRunsc(): boolean {
  try {
    execSync('command -v runsc', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function buildSandboxApp() {
  return buildTestApp(async (app) => {
    await app.register(sandboxRoutes, { prefix: '/v1/sandbox' });
    await app.register(approvalRoutes, { prefix: '/v1/approvals' });
  });
}

describe('sandbox routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildSandboxApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sandbox/config',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('reports the active sandbox mode', async () => {
    const token = `sandbox_config_${Date.now()}`;
    const app = await buildSandboxApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sandbox/config',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.mode).toBeDefined();
    expect(typeof body.gvisor).toBe('boolean');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('no longer exposes an immediate /run endpoint', async () => {
    const token = `sandbox_run_removed_${Date.now()}`;
    const app = await buildSandboxApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sandbox/run',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        command: 'echo',
        args: ['should not run'],
        timeoutMs: 5_000,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('rejects dangerous code in static analysis', async () => {
    const token = `sandbox_analyze_${Date.now()}`;
    const app = await buildSandboxApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sandbox/analyze',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        code: "import { exec } from 'child_process'; eval('rm -rf /');",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.ok).toBe(false);
    expect(body.messages.length).toBeGreaterThan(0);
    const ruleIds = body.messages.map((m: { ruleId?: string }) => m.ruleId);
    expect(ruleIds).toContain('no-eval');
    expect(ruleIds).toContain('no-restricted-imports');
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'gate rejects dangerous code before creating an approval',
    async () => {
      const token = `sandbox_gate_danger_${Date.now()}`;
      const app = await buildSandboxApp();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sandbox/gate',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: "fetch('https://example.com');",
          run: { command: 'echo', args: ['should not run'], timeoutMs: 5_000 },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('STATIC_ANALYSIS_FAILED');
      expect(body.error.analysis.ok).toBe(false);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'gate returns an approvalId and runs the code after approval',
    async () => {
      const token = `sandbox_gate_safe_${Date.now()}`;
      const app = await buildSandboxApp();

      const gateResponse = await app.inject({
        method: 'POST',
        url: '/v1/sandbox/gate',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'export function add(a: number, b: number): number { return a + b; }',
          run: { command: 'echo', args: ['gate ok'], timeoutMs: 5_000 },
        },
      });

      expect(gateResponse.statusCode).toBe(202);
      const gateBody = JSON.parse(gateResponse.body);
      expect(gateBody.approvalId).toBeDefined();
      expect(gateBody.analysis.ok).toBe(true);

      const approveResponse = await app.inject({
        method: 'POST',
        url: `/v1/approvals/${gateBody.approvalId}/approve`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(approveResponse.statusCode).toBe(200);
      const approveBody = JSON.parse(approveResponse.body);
      expect(approveBody.run.exitCode).toBe(0);
      expect(approveBody.run.stdout).toContain('gate ok');
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS || !hasRunsc())(
    'runs a real gVisor sandbox through the approval flow',
    async () => {
      const token = `sandbox_gvisor_${Date.now()}`;
      const originalMode = process.env.SANDBOX_MODE;
      process.env.SANDBOX_MODE = 'gvisor';

      const app = await buildSandboxApp();

      const executeResponse = await app.inject({
        method: 'POST',
        url: '/v1/sandbox/execute',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'export const msg = "gvisor ok";',
          command: 'echo',
          args: ['gvisor ok'],
          timeoutMs: 10_000,
        },
      });

      process.env.SANDBOX_MODE = originalMode;

      expect(executeResponse.statusCode).toBe(202);
      const executeBody = JSON.parse(executeResponse.body);
      expect(executeBody.approvalId).toBeDefined();

      const approveResponse = await app.inject({
        method: 'POST',
        url: `/v1/approvals/${executeBody.approvalId}/approve`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(approveResponse.statusCode).toBe(200);
      const approveBody = JSON.parse(approveResponse.body);
      expect(approveBody.run.exitCode).toBe(0);
      expect(approveBody.run.stdout).toContain('gvisor ok');
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'execute returns an approvalId and runs safe code after approval',
    async () => {
      const token = `sandbox_execute_safe_${Date.now()}`;
      const app = await buildSandboxApp();

      const executeResponse = await app.inject({
        method: 'POST',
        url: '/v1/sandbox/execute',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'export function add(a: number, b: number): number { return a + b; }',
          command: 'echo',
          args: ['execute ok'],
          timeoutMs: 5_000,
        },
      });

      expect(executeResponse.statusCode).toBe(202);
      const executeBody = JSON.parse(executeResponse.body);
      expect(executeBody.approvalId).toBeDefined();
      expect(executeBody.analysis.ok).toBe(true);

      const approveResponse = await app.inject({
        method: 'POST',
        url: `/v1/approvals/${executeBody.approvalId}/approve`,
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      });

      expect(approveResponse.statusCode).toBe(200);
      const approveBody = JSON.parse(approveResponse.body);
      expect(approveBody.run.exitCode).toBe(0);
      expect(approveBody.run.stdout).toContain('execute ok');
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'execute rejects dangerous code before creating an approval',
    async () => {
      const token = `sandbox_execute_danger_${Date.now()}`;
      const app = await buildSandboxApp();

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sandbox/execute',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: "fetch('https://example.com');",
          command: 'echo',
          args: ['should not run'],
          timeoutMs: 5_000,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('STATIC_ANALYSIS_FAILED');
      expect(body.error.analysis.ok).toBe(false);
    }
  );

  it('refuses passthrough mode in production', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalMode = process.env.SANDBOX_MODE;
    process.env.NODE_ENV = 'production';
    process.env.SANDBOX_MODE = 'passthrough';

    await expect(createSandboxRunner()).rejects.toThrow(
      'SANDBOX_MODE=passthrough is not allowed in production'
    );

    process.env.NODE_ENV = originalNodeEnv;
    process.env.SANDBOX_MODE = originalMode;
  });
});
