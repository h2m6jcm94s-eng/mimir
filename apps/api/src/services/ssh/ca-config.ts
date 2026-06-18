import { readFile } from 'node:fs/promises';
import { secrets } from '../../config/secrets';

export async function getSshCaPrivateKey(type: 'user' | 'host'): Promise<string> {
  const envKey = type === 'user' ? 'SSH_CA_USER_PRIVATE_KEY' : 'SSH_CA_HOST_PRIVATE_KEY';
  const envFile = type === 'user' ? 'SSH_CA_USER_PRIVATE_KEY_FILE' : 'SSH_CA_HOST_PRIVATE_KEY_FILE';
  const vaultAlias = type === 'user' ? 'ssh-ca-user-private' : 'ssh-ca-host-private';

  const direct = process.env[envKey];
  if (direct) return direct;

  const filePath = process.env[envFile];
  if (filePath) {
    return readFile(filePath, 'utf8');
  }

  const fromVault = await secrets.get(vaultAlias);
  if (fromVault) return fromVault;

  throw new Error(
    `SSH CA ${type} private key is not configured. Set ${envKey}, ${envFile}, or store it in the vault as ${vaultAlias}.`
  );
}
