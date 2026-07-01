import { SetPinRequest } from '@mimir/shared-types';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { protectedRouteConfig } from '../middleware/route-config';
import { hashPin, verifyPin } from '../services/approvals/metadata';

export async function userRoutes(app: FastifyInstance) {
  app.get('/me', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }

    const userAccount = await db.query.userAccount.findFirst({
      where: eq(schema.userAccount.id, user.userAccountId),
    });
    if (!userAccount) {
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'User account not found' },
      });
    }

    return reply.send({
      data: {
        id: userAccount.id,
        tenantId: user.tenantId,
        email: userAccount.email,
        pinSet: Boolean(userAccount.pinHash),
      },
    });
  });

  app.post('/me/pin', { config: protectedRouteConfig }, async (request: FastifyRequest, reply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }

    const body = SetPinRequest.parse(request.body ?? {});

    const userAccount = await db.query.userAccount.findFirst({
      where: eq(schema.userAccount.id, user.userAccountId),
    });
    if (!userAccount) {
      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'User account not found' },
      });
    }

    if (userAccount.pinHash && !verifyPin(body.currentPin, userAccount.pinHash)) {
      return reply.status(403).send({
        error: { code: 'INVALID_CURRENT_PIN', message: 'Current PIN is incorrect' },
      });
    }

    await db
      .update(schema.userAccount)
      .set({ pinHash: hashPin(body.pin) })
      .where(eq(schema.userAccount.id, user.userAccountId));

    return reply.send({ ok: true });
  });
}
