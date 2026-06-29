import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CliConfig {
  apiUrl: string;
  apiKey: string;
}

const ENVELOPE_PREFIX = 'mimir:enc:v1:';

function getConfigPath(): string {
  const configDir = process.env.MIMIR_CLI_CONFIG_DIR || join(homedir(), '.config', 'mimir');
  return join(configDir, 'config.json');
}

function ensureConfigDir(path: string): void {
  const configDir = path.slice(0, path.lastIndexOf('/'));
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32);
}

function encrypt(plaintext: string, passphrase: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(16);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const envelope = [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
  return `${ENVELOPE_PREFIX}${envelope}`;
}

function decrypt(envelope: string, passphrase: string): string {
  if (!envelope.startsWith(ENVELOPE_PREFIX)) {
    throw new Error('Unrecognized encrypted config envelope');
  }
  const parts = envelope.slice(ENVELOPE_PREFIX.length).split(':');
  if (parts.length !== 4) {
    throw new Error('Malformed encrypted config envelope');
  }
  const [saltB64, ivB64, authTagB64, cipherB64] = parts;
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(cipherB64, 'base64');
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function isEncryptedEnvelope(text: string): boolean {
  return text.startsWith(ENVELOPE_PREFIX);
}

function getPassphrase(): string | undefined {
  const value = process.env.MIMIR_CLI_PASSPHRASE;
  return value && value.length > 0 ? value : undefined;
}

export function readConfig(): Partial<CliConfig> {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return {};
  const raw = readFileSync(configPath, 'utf8');

  if (isEncryptedEnvelope(raw)) {
    const passphrase = getPassphrase();
    if (!passphrase) {
      throw new Error('CLI config is encrypted. Set MIMIR_CLI_PASSPHRASE to decrypt it.');
    }
    const plaintext = decrypt(raw, passphrase);
    return JSON.parse(plaintext) as Partial<CliConfig>;
  }

  try {
    return JSON.parse(raw) as Partial<CliConfig>;
  } catch {
    return {};
  }
}

export function writeConfig(config: Partial<CliConfig>): void {
  const configPath = getConfigPath();
  ensureConfigDir(configPath);

  const passphrase = getPassphrase();
  if (passphrase) {
    const envelope = encrypt(JSON.stringify(config), passphrase);
    writeFileSync(configPath, envelope, { mode: 0o600 });
    return;
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  console.warn('Warning: CLI config written as plaintext. Set MIMIR_CLI_PASSPHRASE to encrypt it.');
}

export function getEffectiveConfig(): CliConfig {
  const file = readConfig();
  return {
    apiUrl: process.env.MIMIR_API_URL || file.apiUrl || 'http://localhost:3001',
    apiKey: process.env.MIMIR_API_KEY || file.apiKey || '',
  };
}
