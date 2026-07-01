import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';
import {
  type ScimUserInput,
  createScimUser,
  deleteScimUser,
  getScimUserById,
  listScimUsers,
  replaceScimUser,
  setScimUserActive,
} from '../repositories/scim';

const SCIM_CONTENT_TYPE = 'application/scim+json';

function scimDate(date: Date): string {
  return date.toISOString();
}

function toScimUser(record: Awaited<ReturnType<typeof getScimUserById>> & {}) {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: record.appUserId,
    userName: record.userName,
    name: record.name,
    emails: [{ value: record.email, primary: true }],
    active: record.active,
    meta: {
      resourceType: 'User',
      created: scimDate(record.createdAt),
      lastModified: scimDate(record.updatedAt),
    },
  };
}

function scimError(reply: FastifyReply, status: number, detail?: string) {
  return reply
    .status(status)
    .header('Content-Type', SCIM_CONTENT_TYPE)
    .send({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: String(status),
      detail,
    });
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function resolveScimToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<typeof schema.scimToken.$inferSelect | undefined> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    scimError(reply, 401, 'Missing or invalid authorization');
    return undefined;
  }

  const token = header.slice(7);
  const tokenRow = await db.query.scimToken.findFirst({
    where: eq(schema.scimToken.tokenHash, hashToken(token)),
  });

  if (!tokenRow) {
    scimError(reply, 401, 'Invalid token');
    return undefined;
  }

  return tokenRow;
}

export async function scimRoutes(app: FastifyInstance) {
  app.addContentTypeParser(
    'application/scim+json',
    { parseAs: 'string' },
    (_request, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch {
        done(new Error('Invalid JSON'), undefined);
      }
    }
  );

  app.addHook('preHandler', async (request, reply) => {
    const tokenRow = await resolveScimToken(request, reply);
    if (!tokenRow) {
      return reply;
    }
    (request as unknown as Record<string, unknown>).scimToken = tokenRow;
  });

  app.get(
    '/Users',
    async (
      request: FastifyRequest<{ Querystring: { startIndex?: string; count?: string } }>,
      reply
    ) => {
      const tokenRow = (request as unknown as Record<string, unknown>).scimToken as {
        tenantId: string;
      };
      const startIndex = Number(request.query.startIndex);
      const count = Number(request.query.count);

      const result = await withTenantTransaction(tokenRow.tenantId, async (ctx) => {
        return listScimUsers(ctx, {
          startIndex: Number.isNaN(startIndex) ? undefined : startIndex,
          count: Number.isNaN(count) ? undefined : count,
        });
      });

      return reply.header('Content-Type', SCIM_CONTENT_TYPE).send({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults: result.total,
        Resources: result.users.map(toScimUser),
      });
    }
  );

  app.get('/Users/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const tokenRow = (request as unknown as Record<string, unknown>).scimToken as {
      tenantId: string;
    };

    const record = await withTenantTransaction(tokenRow.tenantId, async (ctx) => {
      return getScimUserById(ctx, request.params.id);
    });

    if (!record) {
      return scimError(reply, 404, 'User not found');
    }

    return reply.header('Content-Type', SCIM_CONTENT_TYPE).send(toScimUser(record));
  });

  app.post('/Users', async (request: FastifyRequest<{ Body: ScimUserInput }>, reply) => {
    const tokenRow = (request as unknown as Record<string, unknown>).scimToken as {
      tenantId: string;
    };

    try {
      const record = await withTenantTransaction(tokenRow.tenantId, async (ctx) => {
        return createScimUser(ctx, request.body);
      });
      return reply.status(201).header('Content-Type', SCIM_CONTENT_TYPE).send(toScimUser(record));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'User creation failed';
      return scimError(reply, 409, message);
    }
  });

  app.put(
    '/Users/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Body: ScimUserInput }>, reply) => {
      const tokenRow = (request as unknown as Record<string, unknown>).scimToken as {
        tenantId: string;
      };

      try {
        const record = await withTenantTransaction(tokenRow.tenantId, async (ctx) => {
          return replaceScimUser(ctx, request.params.id, request.body);
        });

        if (!record) {
          return scimError(reply, 404, 'User not found');
        }

        return reply.header('Content-Type', SCIM_CONTENT_TYPE).send(toScimUser(record));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'User update failed';
        return scimError(reply, 400, message);
      }
    }
  );

  app.patch(
    '/Users/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { Operations?: Array<{ op: string; path?: string; value?: unknown }> };
      }>,
      reply
    ) => {
      const tokenRow = (request as unknown as Record<string, unknown>).scimToken as {
        tenantId: string;
      };

      const operation = request.body.Operations?.find(
        (o) => String(o.op).toLowerCase() === 'replace' && String(o.path).toLowerCase() === 'active'
      );

      if (!operation) {
        return scimError(reply, 400, 'Unsupported PATCH operation');
      }

      const active = Boolean(operation.value);
      const record = await withTenantTransaction(tokenRow.tenantId, async (ctx) => {
        return setScimUserActive(ctx, request.params.id, active);
      });

      if (!record) {
        return scimError(reply, 404, 'User not found');
      }

      return reply.header('Content-Type', SCIM_CONTENT_TYPE).send(toScimUser(record));
    }
  );

  app.delete('/Users/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const tokenRow = (request as unknown as Record<string, unknown>).scimToken as {
      tenantId: string;
    };

    const deleted = await withTenantTransaction(tokenRow.tenantId, async (ctx) => {
      return deleteScimUser(ctx, request.params.id);
    });

    if (!deleted) {
      return scimError(reply, 404, 'User not found');
    }

    return reply.status(204).send();
  });
}
