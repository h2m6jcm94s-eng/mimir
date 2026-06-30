import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { secrets } from '../../config/secrets';
import { redis } from '../../db/redis';

const DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes

export class CloudWorkerTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CloudWorkerTokenError';
  }
}

let cachedCloudWorkerSecret: string | undefined;

export async function resolveCloudWorkerSecret(): Promise<void> {
  cachedCloudWorkerSecret = await secrets.get('cloud-worker-secret');
}

function getSecret(): string {
  const secret = cachedCloudWorkerSecret ?? process.env.CLOUD_WORKER_SECRET;
  if (!secret) {
    throw new CloudWorkerTokenError('CLOUD_WORKER_SECRET is not configured');
  }
  return secret;
}

export interface ReturnTokenPayload {
  jobId: string;
  tenantId: string;
  exp: number;
  nonce: string;
}

export function signReturnToken(
  payload: Omit<ReturnTokenPayload, 'exp' | 'nonce'>,
  ttlSeconds = DEFAULT_TTL_SECONDS
): string {
  const secret = getSecret();

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = randomBytes(16).toString('hex');
  const full: ReturnTokenPayload = { ...payload, exp, nonce };
  const body = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function parseReturnToken(token: string): ReturnTokenPayload {
  const secret = getSecret();

  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new CloudWorkerTokenError('Malformed token');
  }

  const [body, sig] = parts;
  const expectedSig = createHmac('sha256', secret).update(body).digest('base64url');
  if (
    sig.length !== expectedSig.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
  ) {
    throw new CloudWorkerTokenError('Invalid token signature');
  }

  let payload: ReturnTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new CloudWorkerTokenError('Malformed token payload');
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new CloudWorkerTokenError('Token expired');
  }

  return payload;
}

export async function consumeReturnToken(token: string): Promise<ReturnTokenPayload> {
  const payload = parseReturnToken(token);

  const usedKey = `cloud_worker_return:${payload.tenantId}:${payload.jobId}:${payload.nonce}`;
  const stored = await redis.set(usedKey, '1', 'EX', DEFAULT_TTL_SECONDS, 'NX');
  if (stored !== 'OK') {
    throw new CloudWorkerTokenError('Token already used');
  }

  return payload;
}
