import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { pingRedis } from '../db/redis';
import { runGlobalIntegrityCheck } from '../services/state/integrity';
import { checkLibSql, getOldestReplicaLagMs } from '../services/state/read';
import { checkTemporal } from '../temporal/client';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/livez', async () => ({ status: 'alive' }));

  app.get('/readyz', async () => {
    const [postgres, redis, temporal, libsql, libsqlLagMs, libsqlIntegrity] = await Promise.all([
      checkPostgres(),
      pingRedis(),
      checkTemporal(),
      checkLibSql(),
      getOldestReplicaLagMs(),
      checkLibSqlIntegrity(),
    ]);

    const dependencies = { postgres, redis, temporal, libsql };
    const ready = Object.values(dependencies).every((v) => v === 'ok');

    return {
      status: ready && libsqlIntegrity.ok ? 'ready' : 'not_ready',
      dependencies,
      libsqlLagMs,
      libsqlIntegrity,
    };
  });

  app.get('/healthz', async () => {
    const [postgres, redis, temporal, libsql, libsqlLagMs, libsqlIntegrity] = await Promise.all([
      checkPostgres(),
      pingRedis(),
      checkTemporal(),
      checkLibSql(),
      getOldestReplicaLagMs(),
      checkLibSqlIntegrity(),
    ]);

    const dependencies = { postgres, redis, temporal, libsql };
    const healthy = Object.values(dependencies).every((v) => v === 'ok');

    return {
      status: healthy && libsqlIntegrity.ok ? 'healthy' : 'degraded',
      dependencies,
      libsqlLagMs,
      libsqlIntegrity,
    };
  });
}

async function checkPostgres(): Promise<'ok' | 'error'> {
  try {
    await db.execute(sql`select 1`);
    return 'ok';
  } catch (err) {
    console.error('Postgres health check failed:', err);
    return 'error';
  }
}

async function checkLibSqlIntegrity(): Promise<{
  ok: boolean;
  databaseIntegrity: string;
  tenants: number;
}> {
  try {
    const result = await runGlobalIntegrityCheck();
    return {
      ok: result.ok,
      databaseIntegrity: result.databaseIntegrity,
      tenants: result.tenants.length,
    };
  } catch (err) {
    console.error('LibSQL integrity check failed:', err);
    return { ok: false, databaseIntegrity: 'error', tenants: 0 };
  }
}
