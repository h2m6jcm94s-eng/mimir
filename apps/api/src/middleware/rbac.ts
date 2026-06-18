import type { FastifyReply, FastifyRequest } from 'fastify';

export const Scopes = {
  CHAT_WRITE: 'chat:write',
  CHAT_READ: 'chat:read',
  JOBS_WRITE: 'jobs:write',
  JOBS_READ: 'jobs:read',
  APPROVALS_WRITE: 'approvals:write',
  APPROVALS_READ: 'approvals:read',
  AUDIT_READ: 'audit:read',
  GOVERNANCE_READ: 'governance:read',
  GOVERNANCE_WRITE: 'governance:write',
  KNOWLEDGE_WRITE: 'knowledge:write',
  KNOWLEDGE_READ: 'knowledge:read',
  CONNECTORS_ADMIN: 'connectors:admin',
  NODES_READ: 'nodes:read',
  NODES_WRITE: 'nodes:write',
  COST_READ: 'cost:read',
  BUDGET_READ: 'budget:read',
  BUDGET_WRITE: 'budget:write',
  HALT_READ: 'halt:read',
  HALT_WRITE: 'halt:write',
  REPORTS_READ: 'reports:read',
  METRICS_READ: 'metrics:read',
  SANDBOX_RUN: 'sandbox:run',
  SANDBOX_ANALYZE: 'sandbox:analyze',
  SANDBOX_READ: 'sandbox:read',
  COMPANION_READ: 'companion:read',
  COMPANION_WRITE: 'companion:write',
  NOTIFICATIONS_READ: 'notifications:read',
  NOTIFICATIONS_WRITE: 'notifications:write',
  LIFE_ADMIN_READ: 'life_admin:read',
  LIFE_ADMIN_WRITE: 'life_admin:write',
  MARKETING_READ: 'marketing:read',
  MARKETING_WRITE: 'marketing:write',
  SCHEDULING_READ: 'scheduling:read',
  SCHEDULING_WRITE: 'scheduling:write',
  TOOLS_READ: 'tools:read',
  TOOLS_WRITE: 'tools:write',
  CLOUD_WORKERS_ADMIN: 'cloud_workers:admin',
  SSH_CA_SIGN: 'ssh_ca:sign',
  MEMORY_READ: 'memory:read',
  MEMORY_WRITE: 'memory:write',
} as const;

const ROLE_SCOPES: Record<string, string[]> = {
  owner: Object.values(Scopes),
  admin: Object.values(Scopes),
  member: [
    Scopes.CHAT_WRITE,
    Scopes.CHAT_READ,
    Scopes.JOBS_WRITE,
    Scopes.JOBS_READ,
    Scopes.APPROVALS_WRITE,
    Scopes.APPROVALS_READ,
    Scopes.AUDIT_READ,
    Scopes.KNOWLEDGE_WRITE,
    Scopes.KNOWLEDGE_READ,
    Scopes.NODES_READ,
    Scopes.NODES_WRITE,
    Scopes.COST_READ,
    Scopes.BUDGET_READ,
    Scopes.HALT_READ,
    Scopes.REPORTS_READ,
    Scopes.METRICS_READ,
    Scopes.SANDBOX_ANALYZE,
    Scopes.COMPANION_READ,
    Scopes.NOTIFICATIONS_READ,
    Scopes.COMPANION_WRITE,
    Scopes.NOTIFICATIONS_READ,
    Scopes.NOTIFICATIONS_WRITE,
    Scopes.LIFE_ADMIN_READ,
    Scopes.LIFE_ADMIN_WRITE,
    Scopes.MARKETING_READ,
    Scopes.MARKETING_WRITE,
    Scopes.SCHEDULING_READ,
    Scopes.SCHEDULING_WRITE,
    Scopes.TOOLS_READ,
    Scopes.TOOLS_WRITE,
    Scopes.CLOUD_WORKERS_ADMIN,
    Scopes.SSH_CA_SIGN,
    Scopes.MEMORY_READ,
    Scopes.MEMORY_WRITE,
  ],
  viewer: [
    Scopes.CHAT_READ,
    Scopes.JOBS_READ,
    Scopes.APPROVALS_READ,
    Scopes.KNOWLEDGE_READ,
    Scopes.NODES_READ,
    Scopes.COST_READ,
    Scopes.BUDGET_READ,
    Scopes.HALT_READ,
    Scopes.REPORTS_READ,
    Scopes.METRICS_READ,
    Scopes.LIFE_ADMIN_READ,
    Scopes.MARKETING_READ,
    Scopes.SCHEDULING_READ,
    Scopes.TOOLS_READ,
  ],
};

export function requireScope(scope: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }

    const allowed = ROLE_SCOPES[user.role] || [];
    if (!allowed.includes(scope)) {
      return reply
        .status(403)
        .send({ error: { code: 'FORBIDDEN', message: 'Insufficient scope' } });
    }
  };
}
