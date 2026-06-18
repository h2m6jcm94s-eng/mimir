import {
  BranchMemoryCheckpointRequest,
  CreateMemoryCheckpointRequest,
  CreateMemoryEdgeRequest,
  CreateMemoryNodeRequest,
  CreateRelationshipMemoryRequest,
  type MemoryEdge as MemoryEdgeType,
  MemoryGraphQuery,
  type MemoryNode as MemoryNodeType,
  UpdateMemoryNodeRequest,
} from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import { createAuditEvent } from '../repositories/audit';
import * as graphService from '../services/memory/graph';
import * as timeMachineService from '../services/memory/time-machine';

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const checkpointParamsSchema = z.object({
  checkpointId: z.string().uuid(),
});

const diffQuerySchema = z.object({
  compare: z.string().uuid().optional(),
});

function serializeNode(node: {
  id: string;
  tenantId: string;
  kind: string;
  key: string;
  value: unknown;
  validFrom: Date;
  validTo: Date | null;
  createdBy: string | null;
  sourceId: string | null;
  createdAt: Date;
}): MemoryNodeType {
  return {
    id: node.id,
    tenantId: node.tenantId,
    kind: node.kind as MemoryNodeType['kind'],
    key: node.key,
    value: (node.value as Record<string, unknown>) ?? {},
    validFrom: node.validFrom.toISOString(),
    validTo: node.validTo?.toISOString() ?? null,
    createdBy: node.createdBy ?? undefined,
    sourceId: node.sourceId ?? undefined,
    createdAt: node.createdAt.toISOString(),
  };
}

function serializeEdge(edge: {
  id: string;
  tenantId: string;
  sourceId: string;
  targetId: string;
  rel: string;
  weight: number;
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
}): MemoryEdgeType {
  return {
    id: edge.id,
    tenantId: edge.tenantId,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    rel: edge.rel,
    weight: edge.weight,
    validFrom: edge.validFrom.toISOString(),
    validTo: edge.validTo?.toISOString() ?? null,
    createdAt: edge.createdAt.toISOString(),
  };
}

function serializeRelationshipNode(node: {
  id: string;
  value: unknown;
  createdAt: Date;
}) {
  const value = (node.value as Record<string, unknown>) ?? {};
  return {
    id: node.id,
    name: (value.name as string) ?? '',
    relationship: (value.relationship as string) ?? '',
    notes: (value.notes as string | null) ?? null,
    birthday: (value.birthday as string | null) ?? null,
    preferences: (value.preferences as Record<string, string>) ?? {},
    createdAt: node.createdAt.toISOString(),
  };
}

function serializeCheckpoint(checkpoint: {
  id: string;
  tenantId: string;
  label: string;
  createdBy: string | null;
  parentId: string | null;
  nodeSnapshot: unknown;
  edgeSnapshot: unknown;
  createdAt: Date;
}) {
  return {
    id: checkpoint.id,
    tenantId: checkpoint.tenantId,
    label: checkpoint.label,
    createdBy: checkpoint.createdBy ?? undefined,
    parentId: checkpoint.parentId ?? undefined,
    nodeCount: (checkpoint.nodeSnapshot as string[] | undefined)?.length ?? 0,
    edgeCount: (checkpoint.edgeSnapshot as string[] | undefined)?.length ?? 0,
    createdAt: checkpoint.createdAt.toISOString(),
  };
}

export async function memoryRoutes(app: FastifyInstance) {
  app.get(
    '/graph',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MEMORY_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = MemoryGraphQuery.parse(request.query);
      const graph = await withTenantTransaction(user.tenantId, async (ctx) => {
        return graphService.getGraph(ctx, { limit: query.limit });
      });

      return reply.send({
        data: {
          nodes: graph.nodes.map(serializeNode),
          edges: graph.edges.map(serializeEdge),
        },
      });
    }
  );

  app.post(
    '/nodes',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MEMORY_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateMemoryNodeRequest.parse(request.body);
      const node = await withTenantTransaction(user.tenantId, async (ctx) => {
        const created = await graphService.createNode(ctx, {
          ...body,
          createdBy: user.userAccountId,
        });
        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'memory.node.created',
          tier: 0,
          payload: { nodeId: created.id, kind: created.kind, key: created.key },
        });
        return created;
      });

      return reply.status(201).send({ data: serializeNode(node) });
    }
  );

  app.patch(
    '/nodes/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MEMORY_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const body = UpdateMemoryNodeRequest.parse(request.body);
      const node = await withTenantTransaction(user.tenantId, async (ctx) => {
        const updated = await graphService.updateNode(ctx, params.id, body);
        if (updated) {
          await createAuditEvent(ctx, {
            actor: user.userId,
            action: 'memory.node.updated',
            tier: 0,
            payload: { nodeId: updated.id },
          });
        }
        return updated;
      });

      if (!node) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Node not found' } });
      }

      return reply.send({ data: serializeNode(node) });
    }
  );

  app.post(
    '/edges',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MEMORY_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateMemoryEdgeRequest.parse(request.body);
      const edge = await withTenantTransaction(user.tenantId, async (ctx) => {
        const created = await graphService.createEdge(ctx, body);
        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'memory.edge.created',
          tier: 0,
          payload: { edgeId: created.id, sourceId: created.sourceId, targetId: created.targetId },
        });
        return created;
      });

      return reply.status(201).send({ data: serializeEdge(edge) });
    }
  );

  app.delete(
    '/edges/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MEMORY_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = paramsSchema.parse(request.params);
      const removed = await withTenantTransaction(user.tenantId, async (ctx) => {
        return graphService.deleteEdge(ctx, params.id);
      });

      if (!removed) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Edge not found' } });
      }

      return reply.status(204).send();
    }
  );

  app.get(
    '/checkpoints',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MEMORY_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const query = z
        .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
        .parse(request.query);
      const checkpoints = await withTenantTransaction(user.tenantId, async (ctx) => {
        return timeMachineService.listCheckpoints(ctx, { limit: query.limit });
      });

      return reply.send({ data: checkpoints.map(serializeCheckpoint) });
    }
  );

  app.post(
    '/checkpoints',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MEMORY_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateMemoryCheckpointRequest.parse(request.body);
      const checkpoint = await withTenantTransaction(user.tenantId, async (ctx) => {
        const created = await timeMachineService.createCheckpoint(ctx, {
          label: body.label,
          createdBy: user.userAccountId,
        });
        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'memory.checkpoint.created',
          tier: 0,
          payload: { checkpointId: created.id, label: created.label },
        });
        return created;
      });

      return reply.status(201).send({ data: serializeCheckpoint(checkpoint) });
    }
  );

  app.get(
    '/checkpoints/:checkpointId/diff',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MEMORY_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = checkpointParamsSchema.parse(request.params);
      const query = diffQuerySchema.parse(request.query);
      const diff = await withTenantTransaction(user.tenantId, async (ctx) => {
        const previous = await timeMachineService.listCheckpoints(ctx, { limit: 2 });
        const baseline = previous.find((c) => c.id !== params.checkpointId);
        const rightId = query.compare ?? baseline?.id;
        if (!rightId) {
          return {
            addedNodes: [],
            removedNodes: [],
            changedNodes: [],
            addedEdges: [],
            removedEdges: [],
          };
        }
        return timeMachineService.diffCheckpoints(ctx, params.checkpointId, rightId);
      });

      return reply.send({
        data: {
          addedNodes: diff.addedNodes.map(serializeNode),
          removedNodes: diff.removedNodes.map(serializeNode),
          changedNodes: diff.changedNodes.map((c) => ({
            id: c.id,
            before: serializeNode(c.before),
            after: serializeNode(c.after),
          })),
          addedEdges: diff.addedEdges.map(serializeEdge),
          removedEdges: diff.removedEdges.map(serializeEdge),
        },
      });
    }
  );

  app.post(
    '/checkpoints/:checkpointId/restore',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MEMORY_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = checkpointParamsSchema.parse(request.params);
      const checkpoint = await withTenantTransaction(user.tenantId, async (ctx) => {
        const restored = await timeMachineService.restoreCheckpoint(
          ctx,
          params.checkpointId,
          user.userAccountId
        );
        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'memory.checkpoint.restored',
          tier: 0,
          payload: { checkpointId: params.checkpointId, restoredCheckpointId: restored.id },
        });
        return restored;
      });

      return reply.send({ data: serializeCheckpoint(checkpoint) });
    }
  );

  app.post(
    '/branch',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MEMORY_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = BranchMemoryCheckpointRequest.parse(request.body);
      const checkpoint = await withTenantTransaction(user.tenantId, async (ctx) => {
        const branched = await timeMachineService.branchCheckpoint(ctx, {
          fromCheckpointId: body.fromCheckpointId,
          label: body.label,
          createdBy: user.userAccountId,
        });
        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'memory.checkpoint.branched',
          tier: 0,
          payload: { fromCheckpointId: body.fromCheckpointId, branchCheckpointId: branched.id },
        });
        return branched;
      });

      return reply.status(201).send({ data: serializeCheckpoint(checkpoint) });
    }
  );

  app.post(
    '/relationships',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MEMORY_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateRelationshipMemoryRequest.parse(request.body);
      const node = await withTenantTransaction(user.tenantId, async (ctx) => {
        const created = await graphService.createNode(ctx, {
          kind: 'semantic',
          key: `relationship:${body.name.toLowerCase().replace(/\s+/g, '-')}`,
          value: {
            type: 'relationship',
            name: body.name,
            relationship: body.relationship,
            notes: body.notes ?? null,
            birthday: body.birthday ?? null,
            preferences: body.preferences,
          },
          createdBy: user.userAccountId,
        });
        await createAuditEvent(ctx, {
          actor: user.userId,
          action: 'memory.relationship.created',
          tier: 0,
          payload: { nodeId: created.id, name: body.name, relationship: body.relationship },
        });
        return created;
      });

      return reply.status(201).send({ data: serializeRelationshipNode(node) });
    }
  );

  app.get(
    '/relationships',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.MEMORY_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const data = await withTenantTransaction(user.tenantId, async (ctx) => {
        const nodes = await graphService.getNodesByKind(ctx, 'semantic', 100);
        return nodes
          .filter((n) => (n.value as Record<string, unknown>)?.type === 'relationship')
          .map(serializeRelationshipNode);
      });

      return reply.send({ data });
    }
  );
}
