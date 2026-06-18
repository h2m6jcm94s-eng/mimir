import { spawn } from 'node:child_process';
import { which } from '../shell/which';

export interface SandboxRunInput {
  command: string;
  args?: string[];
  timeoutMs?: number;
  env?: Record<string, string>;
  workingDir?: string;
}

export interface SandboxRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export interface SandboxRunner {
  readonly kind: string;
  run(input: SandboxRunInput): Promise<SandboxRunResult>;
}

class GvisorSandboxRunner implements SandboxRunner {
  readonly kind = 'gvisor';
  private runscPath: string;

  constructor(runscPath: string) {
    this.runscPath = runscPath;
  }

  async run(input: SandboxRunInput): Promise<SandboxRunResult> {
    const args = [
      'do',
      '--rootless',
      '--network=none',
      '--overlay',
      ...(input.workingDir ? ['-cwd', input.workingDir] : []),
      ...Object.entries(input.env ?? {}).flatMap(([k, v]) => ['-env', `${k}=${v}`]),
      input.command,
      ...(input.args ?? []),
    ];

    return runWithTimeout(this.runscPath, args, input.timeoutMs ?? 30_000);
  }
}

class PassthroughSandboxRunner implements SandboxRunner {
  readonly kind = 'passthrough';

  async run(input: SandboxRunInput): Promise<SandboxRunResult> {
    return runWithTimeout(input.command, input.args ?? [], input.timeoutMs ?? 30_000, {
      cwd: input.workingDir,
      env: { ...process.env, ...input.env },
    });
  }
}

function runWithTimeout(
  command: string,
  args: string[],
  timeoutMs: number,
  options?: { cwd?: string; env?: NodeJS.ProcessEnv }
): Promise<SandboxRunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      env: options?.env,
      timeout: timeoutMs,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('timeout', () => {
      timedOut = true;
      child.kill('SIGKILL');
    });

    child.on('error', (err) => {
      stderr += err.message;
      resolve({ stdout, stderr, exitCode: child.exitCode ?? 1, timedOut });
    });

    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 0, timedOut });
    });
  });
}

export async function createSandboxRunner(): Promise<SandboxRunner> {
  const mode = process.env.SANDBOX_MODE;
  if (mode === 'passthrough') {
    return new PassthroughSandboxRunner();
  }

  if (mode === 'gvisor') {
    const runsc = await which('runsc');
    if (!runsc) {
      throw new Error('SANDBOX_MODE=gvisor requested but runsc binary not found in PATH');
    }
    return new GvisorSandboxRunner(runsc);
  }

  // Auto-detect: prefer gVisor if available, otherwise warn and fall back to passthrough.
  const runsc = await which('runsc');
  if (runsc) {
    return new GvisorSandboxRunner(runsc);
  }

  return new PassthroughSandboxRunner();
}
