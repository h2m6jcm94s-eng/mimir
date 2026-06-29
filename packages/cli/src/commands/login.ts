import { writeConfig } from '../config';

export function login(apiUrl: string, apiKey: string, passphrase?: string): void {
  if (passphrase) {
    process.env.MIMIR_CLI_PASSPHRASE = passphrase;
  }
  writeConfig({ apiUrl, apiKey });
  console.log(`Saved Mimir configuration for ${apiUrl}`);
}
