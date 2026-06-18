import { writeConfig } from '../config';

export function login(apiUrl: string, apiKey: string): void {
  writeConfig({ apiUrl, apiKey });
  console.log(`Saved Mimir configuration for ${apiUrl}`);
}
