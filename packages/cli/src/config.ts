import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface CliConfig {
  apiUrl: string;
  apiKey: string;
}

function getConfigPath(): string {
  const configDir = process.env.MIMIR_CLI_CONFIG_DIR || join(homedir(), '.config', 'mimir');
  return join(configDir, 'config.json');
}

function ensureConfigDir(path: string): void {
  const configDir = path.slice(0, path.lastIndexOf('/'));
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
}

export function readConfig(): Partial<CliConfig> {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as Partial<CliConfig>;
  } catch {
    return {};
  }
}

export function writeConfig(config: Partial<CliConfig>): void {
  const configPath = getConfigPath();
  ensureConfigDir(configPath);
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function getEffectiveConfig(): CliConfig {
  const file = readConfig();
  return {
    apiUrl: process.env.MIMIR_API_URL || file.apiUrl || 'http://localhost:3001',
    apiKey: process.env.MIMIR_API_KEY || file.apiKey || '',
  };
}
