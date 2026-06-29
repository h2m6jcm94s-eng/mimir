import { resolveCloudWorkerSecret } from '../cloud-worker/token';
import { resolveModelProviderSecrets } from '../models/secrets';

/**
 * Resolve all deployment-level secrets from the vault at startup.
 *
 * This should be called once in both the API server and the Temporal worker
 * before any code reads provider API keys or the cloud-worker HMAC secret.
 */
export async function resolveDeploymentSecrets(): Promise<void> {
  await Promise.all([resolveModelProviderSecrets(), resolveCloudWorkerSecret()]);
}
