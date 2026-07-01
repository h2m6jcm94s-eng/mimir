import { execSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as sshpk from 'sshpk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SshCaError, createSshCaService } from './ca';

describe('ssh ca service', () => {
  let caPrivateKey: string;
  let userPublicKey: string;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'mimir-ssh-test-'));
    const caPath = join(tmpDir, 'ca');
    const userPath = join(tmpDir, 'user');
    execSync(`ssh-keygen -t ed25519 -f ${caPath} -N '' -C ca`, { stdio: 'ignore' });
    execSync(`ssh-keygen -t ed25519 -f ${userPath} -N '' -C user`, { stdio: 'ignore' });
    caPrivateKey = await readFile(caPath, 'utf8');
    userPublicKey = await readFile(`${userPath}.pub`, 'utf8');
  });

  afterEach(async () => {
    // tmpDir is cleaned up by the OS eventually; no sensitive data should remain.
  });

  it('signs a user certificate', async () => {
    const ca = createSshCaService(caPrivateKey);
    const result = await ca.sign({
      publicKey: userPublicKey,
      keyId: 'test-user',
      type: 'user',
      principals: ['alice'],
      validForSeconds: 3600,
    });

    expect(result.certificate).toContain('ssh-ed25519-cert-v01@openssh.com');
    const cert = sshpk.parseCertificate(result.certificate, 'openssh');
    expect(cert.subjects.some((subject) => subject.uid === 'alice')).toBe(true);
    expect(result.validUntil.getTime()).toBeGreaterThan(result.validFrom.getTime());
  });

  it('rejects an invalid private key', () => {
    expect(() => createSshCaService('not-a-key')).toThrow(SshCaError);
  });

  it('rejects an invalid public key', async () => {
    const ca = createSshCaService(caPrivateKey);
    await expect(
      ca.sign({
        publicKey: 'not-a-key',
        keyId: 'bad',
        type: 'user',
        principals: ['alice'],
        validForSeconds: 3600,
      })
    ).rejects.toThrow(SshCaError);
  });
});
