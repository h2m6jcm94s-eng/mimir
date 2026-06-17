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
  COST_READ: 'cost:read',
  BUDGET_READ: 'budget:read',
  BUDGET_WRITE: 'budget:write',
  HALT_READ: 'halt:read',
  HALT_WRITE: 'halt:write',
  REPORTS_READ: 'reports:read',
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
    Scopes.COST_READ,
    Scopes.BUDGET_READ,
    Scopes.HALT_READ,
    Scopes.REPORTS_READ,
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
