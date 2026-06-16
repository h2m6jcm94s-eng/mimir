import { randomUUID } from 'node:crypto';
import { verifyToken } from '@clerk/backend';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loadConfig } from '../config';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
  clerkId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export type TokenVerifier = (token: string) => Promise<{ sub: string; orgId?: string }>;

let tokenVerifier: TokenVerifier | undefined;

export function setTokenVerifier(verifier: TokenVerifier): void {
  tokenVerifier = verifier;
}

export function getTokenVerifier(): TokenVerifier {
  if (tokenVerifier) {
    return tokenVerifier;
  }

  if (process.env.NODE_ENV === 'test' && !loadConfig().clerkSecretKey) {
    // Backward-compatible test fallback. Prefer setTokenVerifier mocks in new tests.
    return async (token: string) => {
      if (token === 'test') {
        return { sub: 'clerk_test_user' };
      }
      throw new Error('Invalid token');
    };
  }

  if (!loadConfig().clerkSecretKey) {
    throw new Error(
      'CLERK_SECRET_KEY is required for Clerk JWT verification. Set it in your environment.'
    );
  }

  return clerkTokenVerifier;
}

async function clerkTokenVerifier(token: string): Promise<{ sub: string; orgId?: string }> {
  const config = loadConfig();
  const payload = await verifyToken(token, {
    secretKey: config.clerkSecretKey,
  });
  const sub = payload.sub;
  if (!sub) {
    throw new Error('Clerk token missing sub claim');
  }
  return { sub, orgId: payload.org_id as string | undefined };
}

export async function resolveAuthUser(token: string): Promise<AuthUser> {
  const verifier = getTokenVerifier();
  const { sub } = await verifier(token);

  const existing = await db.query.authIdentity.findFirst({
    where: eq(schema.authIdentity.clerkId, sub),
  });

  if (existing) {
    return {
      clerkId: existing.clerkId,
      tenantId: existing.tenantId,
      userId: existing.userId,
      role: existing.role,
    };
  }

  // Auto-provision a personal tenant and user for this Clerk id.
  const tenantId = randomUUID();
  const userId = randomUUID();
  const role = 'owner';

  await withTenantTransaction(tenantId, async (ctx) => {
    await ctx.tenantScopedDb.insert(schema.tenant).values({
      id: tenantId,
      name: `Personal ${sub}`,
      plan: 'free',
    });
    await ctx.tenantScopedDb.insert(schema.appUser).values({
      id: userId,
      tenantId,
      clerkId: sub,
      role,
    });
  });

  await db.insert(schema.authIdentity).values({
    clerkId: sub,
    tenantId,
    userId,
    role,
  });

  return {
    clerkId: sub,
    tenantId,
    userId,
    role,
  };
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing bearer token',
          traceId: 'todo',
        },
      });
      return;
    }

    const token = header.slice(7);
    request.user = await resolveAuthUser(token);
  } catch (err: unknown) {
    const error = err as { statusCode?: number; code?: string; message?: string };
    reply.status(error.statusCode || 401).send({
      error: {
        code: error.code || 'UNAUTHORIZED',
        message: error.message || 'Unauthorized',
        traceId: 'todo',
      },
    });
  }
}

export async function registerAuth(app: FastifyInstance) {
  app.decorateRequest('user', undefined);
}
