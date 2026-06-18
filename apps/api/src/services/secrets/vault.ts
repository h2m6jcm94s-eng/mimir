import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export interface VaultBackend {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultError';
  }
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32);
}

function encrypt(value: string, passphrase: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(16);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

function decrypt(token: string, passphrase: string): string {
  const [saltB64, ivB64, authTagB64, cipherB64] = token.split(':');
  if (!saltB64 || !ivB64 || !authTagB64 || !cipherB64) {
    throw new VaultError('Invalid encrypted vault entry');
  }
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(cipherB64, 'base64');
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export class FileVaultBackend implements VaultBackend {
  constructor(
    private filePath: string,
    private passphrase: string
  ) {}

  private async load(): Promise<Record<string, string>> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const decrypted = decrypt(raw, this.passphrase);
      return JSON.parse(decrypted);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw new VaultError(`Failed to decrypt vault file: ${(error as Error).message}`);
    }
  }

  private async save(data: Record<string, string>): Promise<void> {
    const encrypted = encrypt(JSON.stringify(data), this.passphrase);
    await writeFile(this.filePath, encrypted, { mode: 0o600 });
  }

  async get(key: string): Promise<string | undefined> {
    const data = await this.load();
    return data[key];
  }

  async set(key: string, value: string): Promise<void> {
    const data = await this.load();
    data[key] = value;
    await this.save(data);
  }

  async delete(key: string): Promise<void> {
    const data = await this.load();
    delete data[key];
    await this.save(data);
  }
}

export class HashiCorpVaultBackend implements VaultBackend {
  constructor(
    private addr: string,
    private token: string,
    private mount = 'secret',
    private pathPrefix = 'mimir'
  ) {}

  private url(key: string): string {
    const safeKey = encodeURIComponent(key);
    return `${this.addr}/v1/${this.mount}/data/${this.pathPrefix}/${safeKey}`;
  }

  async get(key: string): Promise<string | undefined> {
    const response = await fetch(this.url(key), {
      headers: { 'X-Vault-Token': this.token },
    });
    if (response.status === 404) return undefined;
    if (!response.ok) {
      throw new VaultError(`Vault read failed: ${response.status} ${await response.text()}`);
    }
    const body = (await response.json()) as { data?: { data?: { value?: string } } };
    return body.data?.data?.value;
  }

  async set(key: string, value: string): Promise<void> {
    const response = await fetch(this.url(key), {
      method: 'POST',
      headers: { 'X-Vault-Token': this.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { value } }),
    });
    if (!response.ok) {
      throw new VaultError(`Vault write failed: ${response.status} ${await response.text()}`);
    }
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(this.url(key), {
      method: 'DELETE',
      headers: { 'X-Vault-Token': this.token },
    });
    if (!response.ok && response.status !== 404) {
      throw new VaultError(`Vault delete failed: ${response.status} ${await response.text()}`);
    }
  }
}
