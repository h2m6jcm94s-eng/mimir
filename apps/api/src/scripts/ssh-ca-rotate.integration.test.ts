import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const scriptsDir = resolve(__dirname, '..', '..', '..', '..', 'scripts');

describe('ssh-ca-rotate script', () => {
  it('parses as valid bash', () => {
    const output = execSync(
      `bash -n ${resolve(scriptsDir, 'ssh-ca-rotate.sh')} && echo OK`
    ).toString();
    expect(output.trim()).toBe('OK');
  });

  it.skipIf(!isSshKeygenAvailable())('generates new user and host CA keys', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'mimir-ssh-rotate-'));
    const userKey = join(tmpDir, 'user-ca');
    const hostKey = join(tmpDir, 'host-ca');

    execSync(
      `SSH_CA_USER_PRIVATE_KEY_FILE=${userKey} SSH_CA_HOST_PRIVATE_KEY_FILE=${hostKey} ${resolve(scriptsDir, 'ssh-ca-rotate.sh')}`,
      { stdio: 'pipe' }
    );

    expect(existsSync(`${userKey}.pub`)).toBe(true);
    expect(existsSync(`${hostKey}.pub`)).toBe(true);

    execSync(`rm -rf ${tmpDir}`);
  });
});

function isSshKeygenAvailable(): boolean {
  try {
    execSync('which ssh-keygen', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
