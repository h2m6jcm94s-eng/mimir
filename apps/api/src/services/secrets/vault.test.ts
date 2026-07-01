import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { FileVaultBackend, VaultError } from './vault';

describe('file vault backend', () => {
  let backend: FileVaultBackend;
  let tmpFile: string;

  beforeEach(async () => {
    tmpFile = join(await mkdtemp(join(tmpdir(), 'mimir-vault-')), 'vault.age');
    backend = new FileVaultBackend(tmpFile, 'super-secret-passphrase');
  });

  it('stores and retrieves a secret', async () => {
    await backend.set('api-key', 'shhh');
    const value = await backend.get('api-key');
    expect(value).toBe('shhh');
  });

  it('returns undefined for missing keys', async () => {
    const value = await backend.get('missing');
    expect(value).toBeUndefined();
  });

  it('deletes secrets', async () => {
    await backend.set('tmp', 'value');
    await backend.delete('tmp');
    expect(await backend.get('tmp')).toBeUndefined();
  });

  it('fails to decrypt with the wrong passphrase', async () => {
    await backend.set('api-key', 'shhh');
    const evil = new FileVaultBackend(tmpFile, 'wrong-passphrase');
    await expect(evil.get('api-key')).rejects.toThrow(VaultError);
  });

  it('detects tampered ciphertext', async () => {
    await backend.set('api-key', 'shhh');
    const raw = (await import('node:fs/promises')).readFile;
    const encrypted = await raw(tmpFile, 'utf8');
    await writeFile(tmpFile, `${encrypted.slice(0, -4)}dead`, 'utf8');
    await expect(backend.get('api-key')).rejects.toThrow(VaultError);
  });
});
