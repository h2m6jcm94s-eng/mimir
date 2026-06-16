import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Stub Clerk JWT verification.
 * In production this validates the Clerk session token and resolves tenant_id.
 */
export async function verifyClerkToken(request: FastifyRequest): Promise<AuthUser> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw { statusCode: 401, code: 'UNAUTHORIZED', message: 'Missing bearer token' };
  }

  const token = header.slice(7);
  if (token === 'test') {
    return {
      userId: '00000000-0000-0000-0000-000000000001',
      tenantId: '00000000-0000-0000-0000-000000000000',
      role: 'owner',
    };
  }

  // TODO: integrate Clerk SDK
  throw { statusCode: 401, code: 'UNAUTHORIZED', message: 'Invalid token' };
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    request.user = await verifyClerkToken(request);
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
