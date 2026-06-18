import { describe, expect, it } from 'vitest';
import { resolveAuthUser } from '../middleware/auth';
import { buildTestApp } from '../test-helpers/build-app';
import { schedulingRoutes } from './scheduling';

describe('scheduling routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(schedulingRoutes, { prefix: '/v1/scheduling' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/scheduling/projects',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'creates projects, resources, assignments and reports utilization',
    async () => {
      const token = `scheduling_user_${Date.now()}`;
      await resolveAuthUser(token, `${token}@test.local`);

      const app = await buildTestApp(async (app) => {
        await app.register(schedulingRoutes, { prefix: '/v1/scheduling' });
      });

      const projectResponse = await app.inject({
        method: 'POST',
        url: '/v1/scheduling/projects',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({
          name: 'Website redesign',
          client: 'Acme Corp',
          status: 'active',
          estimatedHours: 80,
        }),
      });
      expect(projectResponse.statusCode).toBe(201);
      const project = JSON.parse(projectResponse.body).data;
      expect(project.name).toBe('Website redesign');

      const resourceResponse = await app.inject({
        method: 'POST',
        url: '/v1/scheduling/resources',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({
          name: 'Alice Designer',
          role: 'Designer',
          weeklyCapacityHours: 40,
        }),
      });
      expect(resourceResponse.statusCode).toBe(201);
      const resource = JSON.parse(resourceResponse.body).data;
      expect(resource.name).toBe('Alice Designer');

      const weekStarting = '2026-06-22';
      const assignmentResponse = await app.inject({
        method: 'POST',
        url: '/v1/scheduling/assignments',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        payload: JSON.stringify({
          projectId: project.id,
          resourceId: resource.id,
          weekStarting,
          allocatedHours: 25,
        }),
      });
      expect(assignmentResponse.statusCode).toBe(201);
      const assignment = JSON.parse(assignmentResponse.body).data;
      expect(assignment.allocatedHours).toBe(25);

      const projectsResponse = await app.inject({
        method: 'GET',
        url: '/v1/scheduling/projects?status=active',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(projectsResponse.statusCode).toBe(200);
      const projects = JSON.parse(projectsResponse.body).data;
      expect(projects.some((p: { id: string }) => p.id === project.id)).toBe(true);

      const utilizationResponse = await app.inject({
        method: 'GET',
        url: `/v1/scheduling/utilization?weekStarting=${weekStarting}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(utilizationResponse.statusCode).toBe(200);
      const summary = JSON.parse(utilizationResponse.body).data;
      expect(summary.totalCapacityHours).toBe(40);
      expect(summary.allocatedHours).toBe(25);
      expect(summary.remainingHours).toBe(15);
    }
  );
});
