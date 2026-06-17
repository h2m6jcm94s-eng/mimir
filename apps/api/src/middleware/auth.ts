import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import Session from 'supertokens-node/recipe/session';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';

export interface AuthUser {
  userId: string;
  userAccountId: string;
  tenantId: string;
  role: string;
  externalId: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export type ExternalIdResolver = (externalId: string, email: string) => Promise<AuthUser>;

function hasTestSessionCookie(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(';').some((entry) => entry.trim().startsWith('mimir_test_session='));
}

let externalIdResolver: ExternalIdResolver | undefined;

export function setExternalIdResolver(resolver: ExternalIdResolver): void {
  externalIdResolver = resolver;
}

export function getExternalIdResolver(): ExternalIdResolver {
  if (externalIdResolver) {
    return externalIdResolver;
  }

  return resolveAuthUser;
}

export async function resolveAuthUser(externalId: string, email: string): Promise<AuthUser> {
  const existingIdentity = await db.query.externalIdentity.findFirst({
    where: eq(schema.externalIdentity.externalId, externalId),
  });

  if (existingIdentity?.defaultTenantId) {
    return withTenantTransaction(existingIdentity.defaultTenantId, async (ctx) => {
      const userAccount = await ctx.tenantScopedDb.query.userAccount.findFirst({
        where: eq(schema.userAccount.id, existingIdentity.userAccountId),
      });
      if (!userAccount) {
        throw new Error('User account not found');
      }

      const membership = await ctx.tenantScopedDb.query.appUser.findFirst({
        where: eq(schema.appUser.userAccountId, existingIdentity.userAccountId),
      });
      if (!membership) {
        throw new Error('Tenant membership not found');
      }

      return {
        userId: membership.id,
        userAccountId: userAccount.id,
        tenantId: membership.tenantId,
        role: membership.role,
        externalId,
        email: userAccount.email,
      };
    });
  }

  const tenantId = randomUUID();
  const userAccountId = randomUUID();
  const appUserId = randomUUID();

  return withTenantTransaction(tenantId, async (ctx) => {
    await ctx.tenantScopedDb.insert(schema.userAccount).values({
      id: userAccountId,
      externalId,
      email,
    });

    await ctx.tenantScopedDb.insert(schema.tenant).values({
      id: tenantId,
      name: `Personal (${email})`,
      plan: 'free',
    });

    await ctx.tenantScopedDb.insert(schema.appUser).values({
      id: appUserId,
      tenantId,
      userAccountId,
      role: 'owner',
    });

    await ctx.tenantScopedDb.insert(schema.externalIdentity).values({
      externalId,
      userAccountId,
      defaultTenantId: tenantId,
    });

    return {
      userId: appUserId,
      userAccountId,
      tenantId,
      role: 'owner',
      externalId,
      email,
    };
  });
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    let externalId: string;
    let email: string;

    if (process.env.NODE_ENV === 'test' && request.headers.authorization?.startsWith('Bearer ')) {
      // Test bypass so integration tests do not need a running Supertokens core.
      externalId = request.headers.authorization.slice(7);
      email = `${externalId}@test.local`;
    } else if (process.env.NODE_ENV === 'test' && hasTestSessionCookie(request.headers.cookie)) {
      // Browser e2e tests set this cookie via fixtures/auth.ts so the web app
      // can call the API without a real Supertokens session.
      externalId = 'test';
      email = 'test@test.local';
    } else {
      const session = await Session.getSession(request, reply, { sessionRequired: false });
      if (!session) {
        return reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid session',
            traceId: 'todo',
          },
        });
      }

      externalId = session.getUserId();
      email =
        (session.getAccessTokenPayload().email as string | undefined) ??
        `user-${randomUUID()}@localhost`;
    }

    const resolver = getExternalIdResolver();
    request.user = await resolver(externalId, email);
  } catch (err: unknown) {
    const error = err as { statusCode?: number; code?: string; message?: string };
    return reply.status(error.statusCode || 401).send({
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
