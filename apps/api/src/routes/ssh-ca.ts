import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createSshCaService } from '../services/ssh/ca';
import { getSshCaPrivateKey } from '../services/ssh/ca-config';

const signSchema = z.object({
  publicKey: z.string().min(1),
  keyId: z.string().min(1),
  type: z.enum(['user', 'host']),
  principals: z.array(z.string().min(1)).min(1),
  validForSeconds: z
    .number()
    .int()
    .min(60)
    .max(365 * 24 * 60 * 60)
    .default(24 * 60 * 60),
});

export async function sshCaRoutes(app: FastifyInstance) {
  app.post(
    '/nodes/:id/ssh-cert',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SSH_CA_SIGN) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const { id } = request.params as { id: string };
      const body = signSchema.parse(request.body);
      const caPrivateKey = await getSshCaPrivateKey(body.type);
      const ca = createSshCaService(caPrivateKey);
      const result = await ca.sign({
        publicKey: body.publicKey,
        keyId: `${body.keyId}-${id}`,
        type: body.type,
        principals: body.principals,
        validForSeconds: body.validForSeconds,
      });

      return reply.send({
        data: {
          certificate: result.certificate,
          nodeId: id,
          validFrom: result.validFrom.toISOString(),
          validUntil: result.validUntil.toISOString(),
        },
      });
    }
  );
}
