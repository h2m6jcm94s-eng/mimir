import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/client';
import { pingRedis } from '../db/redis';
import { checkLibSql, getOldestReplicaLagMs } from '../services/state/read';
import { checkTemporal } from '../temporal/client';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/livez', async () => ({ status: 'alive' }));

  app.get('/readyz', async () => {
    const [postgres, redis, temporal, libsql, libsqlLagMs] = await Promise.all([
      checkPostgres(),
      pingRedis(),
      checkTemporal(),
      checkLibSql(),
      getOldestReplicaLagMs(),
    ]);

    const dependencies = { postgres, redis, temporal, libsql };
    const ready = Object.values(dependencies).every((v) => v === 'ok');

    return {
      status: ready ? 'ready' : 'not_ready',
      dependencies,
      libsqlLagMs,
    };
  });

  app.get('/healthz', async () => {
    const [postgres, redis, temporal, libsql, libsqlLagMs] = await Promise.all([
      checkPostgres(),
      pingRedis(),
      checkTemporal(),
      checkLibSql(),
      getOldestReplicaLagMs(),
    ]);

    const dependencies = { postgres, redis, temporal, libsql };
    const healthy = Object.values(dependencies).every((v) => v === 'ok');

    return {
      status: healthy ? 'healthy' : 'degraded',
      dependencies,
      libsqlLagMs,
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
