import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { secrets } from '../../config/secrets';

export class SshCaKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SshCaKeyError';
  }
}

async function readPrivateKeyFile(filePath: string): Promise<string> {
  if (filePath.endsWith('.age')) {
    const ageIdentity = process.env.AGE_IDENTITY;
    if (!ageIdentity) {
      throw new SshCaKeyError(
        `AGE_IDENTITY is required to decrypt age-encrypted SSH CA key ${filePath}`
      );
    }
    try {
      return execSync(`age -d -i "${ageIdentity}" -o - "${filePath}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch (error) {
      throw new SshCaKeyError(
        `Failed to decrypt SSH CA key ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return readFile(filePath, 'utf8');
}

export async function getSshCaPrivateKey(type: 'user' | 'host'): Promise<string> {
  const envKey = type === 'user' ? 'SSH_CA_USER_PRIVATE_KEY' : 'SSH_CA_HOST_PRIVATE_KEY';
  const envFile = type === 'user' ? 'SSH_CA_USER_PRIVATE_KEY_FILE' : 'SSH_CA_HOST_PRIVATE_KEY_FILE';
  const vaultAlias = type === 'user' ? 'ssh-ca-user-private' : 'ssh-ca-host-private';

  const direct = process.env[envKey];
  if (direct) return direct;

  const filePath = process.env[envFile];
  if (filePath) {
    return readPrivateKeyFile(filePath);
  }

  const fromVault = await secrets.get(vaultAlias);
  if (fromVault) return fromVault;

  throw new SshCaKeyError(
    `SSH CA ${type} private key is not configured. Set ${envKey}, ${envFile}, or store it in the vault as ${vaultAlias}.`
  );
}
