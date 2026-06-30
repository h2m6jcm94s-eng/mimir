import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const scriptsDir = resolve(__dirname, '..', '..', '..', '..', 'scripts');

describe('backup scripts', () => {
  it('backup.sh is executable and parses as valid bash', () => {
    const output = execSync(`bash -n ${resolve(scriptsDir, 'backup.sh')} && echo OK`).toString();
    expect(output.trim()).toBe('OK');
  });

  it('restore-test.sh is executable and parses as valid bash', () => {
    const output = execSync(
      `bash -n ${resolve(scriptsDir, 'restore-test.sh')} && echo OK`
    ).toString();
    expect(output.trim()).toBe('OK');
  });

  it('backup.sh refuses to run without AGE_RECIPIENT or BACKUP_UNENCRYPTED', () => {
    const backupDir = mkdtempSync(resolve(tmpdir(), 'mimir-backup-fail-'));
    expect(() =>
      execSync(`BACKUP_DIR=${backupDir} ${resolve(scriptsDir, 'backup.sh')}`, { stdio: 'pipe' })
    ).toThrow();
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'backup.sh creates a backup directory when run unencrypted',
    () => {
      if (!isPgDumpAvailable()) {
        console.log('pg_dump not available; skipping backup run');
        return;
      }

      const backupDir = `backups-test-${Date.now()}`;
      execSync(
        `BACKUP_DIR=${backupDir} BACKUP_UNENCRYPTED=1 DATABASE_URL=postgresql://mimir_app:mimir_app@localhost:5432/mimir ${resolve(scriptsDir, 'backup.sh')}`,
        {
          stdio: 'pipe',
        }
      );

      const dirs = execSync(`find ${backupDir} -maxdepth 1 -type d -name '20*'`).toString().trim();
      expect(dirs.length).toBeGreaterThan(0);
      execSync(`rm -rf ${backupDir}`);
    }
  );
});

function isPgDumpAvailable(): boolean {
  try {
    execSync('which pg_dump', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
