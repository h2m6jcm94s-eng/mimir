import { syncLibSqlReplica } from '../../db/libsql';

export async function checkPrimaryHealth(): Promise<'ok' | 'error'> {
  try {
    await syncLibSqlReplica();
    return 'ok';
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('LibSQL primary health check failed:', err);
    return 'error';
  }
}

export async function promoteLocalReplicaIfNeeded(candidateNodeId: string): Promise<void> {
  const primaryHealth = await checkPrimaryHealth();
  if (primaryHealth === 'ok') {
    return;
  }

  // TODO: integrate with the fencing promotion lease (R-03) to safely bump epoch and
  // announce this node as the new writer. For now we detect the failure and log the
  // decision so operators can wire an auto-promote controller.
  // eslint-disable-next-line no-console
  console.error(
    `[failover] LibSQL primary is unreachable. Candidate ${candidateNodeId} should acquire the promotion lease and become the new writer.`
  );
}
