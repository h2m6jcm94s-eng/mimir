import { constants, access } from 'node:fs/promises';
import { delimiter } from 'node:path';

/**
 * Portable `which` helper. Resolves the full path to an executable in PATH.
 * Returns undefined if the command cannot be found.
 */
export async function which(command: string): Promise<string | undefined> {
  if (process.platform === 'win32') {
    // Windows resolution is more complex; return undefined for now.
    return undefined;
  }

  const pathEnv = process.env.PATH ?? '';
  const candidates = pathEnv.split(delimiter).map((dir) => `${dir}/${command}`);

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // continue searching
    }
  }

  return undefined;
}
