import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEffectiveConfig, readConfig, writeConfig } from './config';

describe('CLI config', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mimir-cli-'));
    vi.stubEnv('MIMIR_CLI_CONFIG_DIR', tempDir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns defaults when no config exists', () => {
    const config = getEffectiveConfig();
    expect(config.apiUrl).toBe('http://localhost:3001');
    expect(config.apiKey).toBe('');
  });

  it('reads back written config', () => {
    writeConfig({ apiUrl: 'http://example.com', apiKey: 'secret' });
    const config = readConfig();
    expect(config.apiUrl).toBe('http://example.com');
    expect(config.apiKey).toBe('secret');
  });

  it('prefers environment variables over file config', () => {
    writeConfig({ apiUrl: 'http://file.com', apiKey: 'file-key' });
    vi.stubEnv('MIMIR_API_URL', 'http://env.com');
    vi.stubEnv('MIMIR_API_KEY', 'env-key');

    const config = getEffectiveConfig();
    expect(config.apiUrl).toBe('http://env.com');
    expect(config.apiKey).toBe('env-key');
  });
});
