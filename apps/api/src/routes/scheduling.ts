import {
  CreateProjectRequest,
  CreateResourceRequest,
  CreateScheduleAssignmentRequest,
  type Project,
  type Resource,
  type ScheduleAssignment,
  SchedulingProjectStatus,
  UpdateProjectRequest,
  UpdateResourceRequest,
  UpdateScheduleAssignmentRequest,
  UtilizationSummary,
} from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import type { ProjectStatus } from '../repositories/scheduling';
import * as schedulingService from '../services/scheduling/scheduler';

const paramsSchema = z.object({ id: z.string().uuid() });
const weekStartingSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function formatDate(iso: Date | string | null): string | null {
  if (!iso) return null;
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return date.toISOString();
}

function formatWeekStarting(value: Date | string): string {
  if (typeof value === 'string') return value;
  const iso = value.toISOString();
  return iso.slice(0, 10);
}

function serializeProject(row: {
  id: string;
  tenantId: string;
  name: string;
  client: string;
  deadline: Date | null;
  status: string;
  estimatedHours: number | null;
  createdAt: Date;
  updatedAt: Date;
}): Project {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    client: row.client,
    deadline: formatDate(row.deadline),
    status: row.status as Project['status'],
    estimatedHours: row.estimatedHours,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeResource(row: {
  id: string;
  tenantId: string;
  name: string;
  role: string;
  weeklyCapacityHours: number;
  createdAt: Date;
  updatedAt: Date;
}): Resource {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    role: row.role,
    weeklyCapacityHours: row.weeklyCapacityHours,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeAssignment(row: {
  id: string;
  tenantId: string;
  projectId: string;
  resourceId: string;
  weekStarting: Date | string;
  allocatedHours: number;
  createdAt: Date;
  updatedAt: Date;
}): ScheduleAssignment {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    resourceId: row.resourceId,
    weekStarting: formatWeekStarting(row.weekStarting),
    allocatedHours: row.allocatedHours,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function schedulingRoutes(app: FastifyInstance) {
  app.get(
    '/projects',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const query = z
        .object({
          status: SchedulingProjectStatus.optional(),
          limit: z.coerce.number().int().min(1).max(200).default(100),
        })
        .parse(request.query);

      const projects = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.listProjects(ctx, {
          status: query.status as ProjectStatus | undefined,
          limit: query.limit,
        });
      });
      return reply.send({ data: projects.map(serializeProject) });
    }
  );

  app.post(
    '/projects',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = CreateProjectRequest.parse(request.body);
      const created = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.createProject(ctx, {
          ...body,
          status: body.status as ProjectStatus | undefined,
          deadline: body.deadline ? new Date(body.deadline) : undefined,
        });
      });
      return reply.status(201).send({ data: serializeProject(created) });
    }
  );

  app.patch(
    '/projects/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const body = UpdateProjectRequest.parse(request.body);
      const updated = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.updateProject(ctx, params.id, {
          ...body,
          status: body.status as ProjectStatus | undefined,
          deadline:
            body.deadline === undefined
              ? undefined
              : body.deadline
                ? new Date(body.deadline)
                : null,
        });
      });
      if (!updated)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return reply.send({ data: serializeProject(updated) });
    }
  );

  app.delete(
    '/projects/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const deleted = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.deleteProject(ctx, params.id);
      });
      if (!deleted)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return reply.status(204).send();
    }
  );

  app.get(
    '/resources',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const query = z
        .object({ limit: z.coerce.number().int().min(1).max(200).default(100) })
        .parse(request.query);

      const resources = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.listResources(ctx, query.limit);
      });
      return reply.send({ data: resources.map(serializeResource) });
    }
  );

  app.post(
    '/resources',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = CreateResourceRequest.parse(request.body);
      const created = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.createResource(ctx, body);
      });
      return reply.status(201).send({ data: serializeResource(created) });
    }
  );

  app.patch(
    '/resources/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const body = UpdateResourceRequest.parse(request.body);
      const updated = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.updateResource(ctx, params.id, body);
      });
      if (!updated)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
      return reply.send({ data: serializeResource(updated) });
    }
  );

  app.delete(
    '/resources/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const deleted = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.deleteResource(ctx, params.id);
      });
      if (!deleted)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
      return reply.status(204).send();
    }
  );

  app.get(
    '/assignments',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const query = z
        .object({
          weekStarting: weekStartingSchema.optional(),
          projectId: z.string().uuid().optional(),
          resourceId: z.string().uuid().optional(),
          limit: z.coerce.number().int().min(1).max(500).default(200),
        })
        .parse(request.query);

      const assignments = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.listScheduleAssignments(ctx, query);
      });
      return reply.send({ data: assignments.map(serializeAssignment) });
    }
  );

  app.post(
    '/assignments',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const body = CreateScheduleAssignmentRequest.parse(request.body);
      const created = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.createScheduleAssignment(ctx, body);
      });
      return reply.status(201).send({ data: serializeAssignment(created) });
    }
  );

  app.patch(
    '/assignments/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const body = UpdateScheduleAssignmentRequest.parse(request.body);
      const updated = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.updateScheduleAssignment(ctx, params.id, body);
      });
      if (!updated)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
      return reply.send({ data: serializeAssignment(updated) });
    }
  );

  app.delete(
    '/assignments/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const params = paramsSchema.parse(request.params);
      const deleted = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.deleteScheduleAssignment(ctx, params.id);
      });
      if (!deleted)
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
      return reply.status(204).send();
    }
  );

  app.get(
    '/utilization',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.SCHEDULING_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user)
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });

      const query = z.object({ weekStarting: weekStartingSchema }).parse(request.query);
      const summary = await withTenantTransaction(user.tenantId, async (ctx) => {
        return schedulingService.getUtilization(ctx, query.weekStarting);
      });
      return reply.send({ data: UtilizationSummary.parse(summary) });
    }
  );
}
