import { type Client as LibSqlClient, createClient } from '@libsql/client';

let libsql: LibSqlClient | null = null;

export function getLibSqlClient(): LibSqlClient {
  if (!libsql) {
    const url = process.env.LIBSQL_URL || 'file:./data/state.db';
    const syncUrl = process.env.LIBSQL_SYNC_URL;
    const authToken = process.env.LIBSQL_AUTH_TOKEN;

    if (process.env.NODE_ENV === 'production') {
      if (!syncUrl) {
        throw new Error(
          'LIBSQL_SYNC_URL is required in production so the embedded replica can stream from a primary.'
        );
      }
      if (!authToken) {
        throw new Error(
          'LIBSQL_AUTH_TOKEN is required in production to authenticate with the LibSQL primary.'
        );
      }
      if (!process.env.LIBSQL_ENCRYPTION_KEY) {
        throw new Error(
          'LIBSQL_ENCRYPTION_KEY is required in production to encrypt the embedded replica.'
        );
      }
    }

    libsql = createClient({
      url,
      syncUrl,
      authToken,
      encryptionKey: process.env.LIBSQL_ENCRYPTION_KEY,
    });
  }
  return libsql;
}

export async function syncLibSqlReplica(): Promise<void> {
  const client = getLibSqlClient();
  if ('sync' in client && typeof client.sync === 'function') {
    await client.sync();
  }
}
