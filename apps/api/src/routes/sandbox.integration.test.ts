import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createSandboxRunner } from '../services/sandbox';
import { buildTestApp } from '../test-helpers/build-app';
import { sandboxRoutes } from './sandbox';

function hasRunsc(): boolean {
  try {
    execSync('command -v runsc', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('sandbox routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(sandboxRoutes, { prefix: '/v1/sandbox' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/sandbox/config',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)('reports the active sandbox mode', async () => {
    const token = `sandbox_config_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(sandboxRoutes, { prefix: '/v1/sandbox' });
    });

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

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'runs a sandboxed echo command in passthrough mode',
    async () => {
      const token = `sandbox_run_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(sandboxRoutes, { prefix: '/v1/sandbox' });
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sandbox/run',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          command: 'echo',
          args: ['hello from sandbox'],
          timeoutMs: 5_000,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.exitCode).toBe(0);
      expect(body.stdout).toContain('hello from sandbox');
      expect(body.timedOut).toBe(false);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('rejects dangerous code in static analysis', async () => {
    const token = `sandbox_analyze_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(sandboxRoutes, { prefix: '/v1/sandbox' });
    });

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
    'gate rejects dangerous code before running it',
    async () => {
      const token = `sandbox_gate_danger_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(sandboxRoutes, { prefix: '/v1/sandbox' });
      });

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

  it.skipIf(!process.env.RUN_DB_TESTS)('gate runs code when static analysis passes', async () => {
    const token = `sandbox_gate_safe_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(sandboxRoutes, { prefix: '/v1/sandbox' });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/sandbox/gate',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        code: 'export function add(a: number, b: number): number { return a + b; }',
        run: { command: 'echo', args: ['gate ok'], timeoutMs: 5_000 },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.allowed).toBe(true);
    expect(body.analysis.ok).toBe(true);
    expect(body.run.exitCode).toBe(0);
    expect(body.run.stdout).toContain('gate ok');
  });

  it.skipIf(!process.env.RUN_DB_TESTS || !hasRunsc())(
    'runs a real gVisor sandbox when runsc is available',
    async () => {
      const token = `sandbox_gvisor_${Date.now()}`;
      const originalMode = process.env.SANDBOX_MODE;
      process.env.SANDBOX_MODE = 'gvisor';

      const app = await buildTestApp(async (app) => {
        await app.register(sandboxRoutes, { prefix: '/v1/sandbox' });
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sandbox/run',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          command: 'echo',
          args: ['gvisor ok'],
          timeoutMs: 10_000,
        },
      });

      process.env.SANDBOX_MODE = originalMode;

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.exitCode).toBe(0);
      expect(body.stdout).toContain('gvisor ok');
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'execute requires a verified PIN and runs safe code through static analysis',
    async () => {
      const token = `sandbox_execute_safe_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(sandboxRoutes, { prefix: '/v1/sandbox' });
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sandbox/execute',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: 'export function add(a: number, b: number): number { return a + b; }',
          command: 'echo',
          args: ['execute ok'],
          timeoutMs: 5_000,
          pin: '1234',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(true);
      expect(body.analysis.ok).toBe(true);
      expect(body.run.exitCode).toBe(0);
      expect(body.run.stdout).toContain('execute ok');
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'execute rejects dangerous code before running it',
    async () => {
      const token = `sandbox_execute_danger_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(sandboxRoutes, { prefix: '/v1/sandbox' });
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sandbox/execute',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          code: "fetch('https://example.com');",
          command: 'echo',
          args: ['should not run'],
          timeoutMs: 5_000,
          pin: '1234',
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
