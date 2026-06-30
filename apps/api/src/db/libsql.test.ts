import { describe, expect, it, vi } from 'vitest';

describe('getLibSqlClient', () => {
  it('requires an encryption key in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LIBSQL_SYNC_URL', 'http://localhost:8080');
    vi.stubEnv('LIBSQL_AUTH_TOKEN', 'test-token');
    vi.stubEnv('LIBSQL_ENCRYPTION_KEY', '');

    const { getLibSqlClient } = await import('./libsql.js');
    expect(() => getLibSqlClient()).toThrow(
      'LIBSQL_ENCRYPTION_KEY is required in production to encrypt the embedded replica'
    );
  });

  it('allows an unencrypted local file in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('LIBSQL_URL', 'file:/tmp/mimir-libsql-dev-test.db');
    vi.stubEnv('LIBSQL_SYNC_URL', '');
    vi.stubEnv('LIBSQL_AUTH_TOKEN', '');
    vi.stubEnv('LIBSQL_ENCRYPTION_KEY', '');

    const { getLibSqlClient } = await import('./libsql.js');
    const client = getLibSqlClient();
    expect(client).toBeDefined();
  });
});
