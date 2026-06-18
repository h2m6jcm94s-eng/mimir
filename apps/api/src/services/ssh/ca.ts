import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface SshCertificateInput {
  publicKey: string;
  keyId: string;
  type: 'user' | 'host';
  principals: string[];
  validForSeconds: number;
}

export interface SshCertificateResult {
  certificate: string;
  validFrom: Date;
  validUntil: Date;
}

export class SshCaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SshCaError';
  }
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatValidityTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  const hour = pad2(date.getUTCHours());
  const minute = pad2(date.getUTCMinutes());
  const second = pad2(date.getUTCSeconds());
  return `${year}${month}${day}${hour}${minute}${second}`;
}

function runCommand(
  cmd: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    proc.stdout.on('data', (data) => stdout.push(data));
    proc.stderr.on('data', (data) => stderr.push(data));
    proc.on('close', (exitCode) => {
      resolve({
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        exitCode: exitCode ?? 1,
      });
    });
  });
}

export function createSshCaService(caPrivateKey: string) {
  if (!caPrivateKey.includes('OPENSSH PRIVATE KEY') && !caPrivateKey.includes('RSA PRIVATE KEY')) {
    throw new SshCaError('SSH CA private key does not look like a supported PEM format');
  }

  return {
    async sign(input: SshCertificateInput): Promise<SshCertificateResult> {
      const tmpDir = await mkdtemp(join(tmpdir(), 'mimir-ssh-ca-'));
      const caPath = join(tmpDir, 'ca');
      const pubPath = join(tmpDir, 'key.pub');
      const certPath = `${pubPath.replace(/\.pub$/, '')}-cert.pub`;

      try {
        await writeFile(caPath, caPrivateKey, { mode: 0o600 });
        await writeFile(pubPath, input.publicKey, { mode: 0o600 });

        const validFrom = new Date();
        const validUntil = new Date(validFrom.getTime() + input.validForSeconds * 1000);
        const validityWindow = `${formatValidityTime(validFrom)}:${formatValidityTime(validUntil)}`;

        const { exitCode, stderr } = await runCommand('ssh-keygen', [
          '-s',
          caPath,
          '-I',
          input.keyId,
          '-n',
          input.principals.join(','),
          '-V',
          validityWindow,
          ...(input.type === 'host' ? ['-h'] : []),
          pubPath,
        ]);

        if (exitCode !== 0) {
          throw new SshCaError(`ssh-keygen failed: ${stderr}`);
        }

        const certificate = await readFile(certPath, 'utf8');
        return { certificate, validFrom, validUntil };
      } finally {
        await unlink(caPath).catch(() => {});
        await unlink(pubPath).catch(() => {});
        await unlink(certPath).catch(() => {});
      }
    },
  };
}

export type SshCaService = ReturnType<typeof createSshCaService>;
