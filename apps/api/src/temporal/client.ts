import { Connection } from '@temporalio/client';

const temporalHost = process.env.TEMPORAL_HOST || 'localhost:7233';

let connection: Connection | undefined;

export async function getTemporalConnection(): Promise<Connection> {
  if (!connection) {
    connection = await Connection.connect({ address: temporalHost });
  }
  return connection;
}

export async function checkTemporal(): Promise<'ok' | 'error'> {
  try {
    const conn = await getTemporalConnection();
    await conn.workflowService.getSystemInfo({});
    return 'ok';
  } catch (err) {
    console.error('Temporal health check failed:', err);
    return 'error';
  }
}
