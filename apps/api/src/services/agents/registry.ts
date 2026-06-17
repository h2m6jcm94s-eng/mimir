import type {
  AgentCapability,
  AgentResolutionRequest,
  AgentResolutionResult,
  AgentRoleInput,
  AgentRoleKind,
} from '@mimir/shared-types';
import { AgentRoleInput as AgentRoleInputSchema } from '@mimir/shared-types';
import type { TenantContext } from '../../db/tenant-context';
import {
  createAgentRole,
  deleteAgentRole,
  findDefaultAgentRole,
  getAgentRole,
  listAgentRoles,
  updateAgentRole,
} from '../../repositories/agent-role';

/**
 * Built-in fallback defaults for every tenant. These are used when a tenant has
 * not configured a custom role and ensure Mimir can always resolve a main/sub
 * agent to a provider/model without being hard-coded to any single vendor.
 */
const BUILT_IN_DEFAULTS: AgentRoleInput[] = [
  {
    kind: 'main',
    name: 'Main brain',
    description: 'General-purpose orchestrator. Picks the best available model by tier.',
    tier: 0,
    priority: 0,
    provider: 'local',
    model: undefined,
    capabilities: [],
    isDefault: true,
  },
  {
    kind: 'main',
    name: 'Main brain (cloud)',
    description: 'General-purpose orchestrator for cloud-tier work.',
    tier: 1,
    priority: 0,
    provider: 'openai',
    model: undefined,
    capabilities: [],
    isDefault: true,
  },
  {
    kind: 'main',
    name: 'Main brain (trusted cloud)',
    description: 'General-purpose orchestrator for trusted cloud-tier work.',
    tier: 2,
    priority: 0,
    provider: 'anthropic',
    model: undefined,
    capabilities: [],
    isDefault: true,
  },
  {
    kind: 'reviewer',
    name: 'Reviewer',
    description: 'Critiques drafts for safety, correctness, and policy compliance.',
    tier: 1,
    priority: 0,
    provider: 'anthropic',
    model: undefined,
    capabilities: ['review', 'reasoning'],
    isDefault: true,
  },
  {
    kind: 'coder',
    name: 'Coder',
    description: 'Generates and edits code, config, and structured artifacts.',
    tier: 1,
    priority: 0,
    provider: 'openai',
    model: undefined,
    capabilities: ['code', 'reasoning'],
    isDefault: true,
  },
  {
    kind: 'planner',
    name: 'Planner',
    description: 'Breaks goals into ordered steps and picks tools/agents.',
    tier: 1,
    priority: 0,
    provider: 'openai',
    model: undefined,
    capabilities: ['plan', 'reasoning'],
    isDefault: true,
  },
  {
    kind: 'memory',
    name: 'Memory keeper',
    description: 'Stores, retrieves, and synthesizes long-term personal memory.',
    tier: 0,
    priority: 0,
    provider: 'local',
    model: undefined,
    capabilities: ['remember', 'search'],
    isDefault: true,
  },
  {
    kind: 'fallback',
    name: 'Fallback',
    description: 'Always-available local stub used when no other role fits.',
    tier: 0,
    priority: 0,
    provider: 'local',
    model: undefined,
    capabilities: ['chat', 'cheap'],
    isDefault: true,
  },
];

function matchesRequest(
  role: { kind: string; tier: number; capabilities: string[] },
  kind: AgentRoleKind,
  tier: number,
  required: AgentCapability[]
): boolean {
  if (role.kind !== kind) return false;
  if (role.tier !== tier) return false;
  if (required.length === 0) return true;
  const caps = new Set(role.capabilities as string[]);
  return required.every((cap) => caps.has(cap));
}

export class AgentRoleRegistry {
  /**
   * Ensure built-in defaults exist for a tenant. Safe to call on every boot;
   * existing rows are left untouched.
   */
  async seedDefaults(ctx: TenantContext): Promise<void> {
    const existing = await listAgentRoles(ctx);
    if (existing.length > 0) return;

    for (const def of BUILT_IN_DEFAULTS) {
      await createAgentRole(ctx, AgentRoleInputSchema.parse(def));
    }
  }

  async list(ctx: TenantContext) {
    return listAgentRoles(ctx);
  }

  async get(ctx: TenantContext, id: string) {
    return getAgentRole(ctx, id);
  }

  async create(ctx: TenantContext, input: AgentRoleInput) {
    return createAgentRole(ctx, input);
  }

  async update(ctx: TenantContext, id: string, input: Partial<AgentRoleInput>) {
    return updateAgentRole(ctx, id, input);
  }

  async delete(ctx: TenantContext, id: string) {
    return deleteAgentRole(ctx, id);
  }

  /**
   * Resolve the best agent role for a request. If a tenant-specific default
   * exists for the exact kind+tier, use it. Otherwise fall back to the first
   * matching tenant role, then to built-in defaults.
   */
  async resolve(
    ctx: TenantContext,
    request: AgentResolutionRequest
  ): Promise<AgentResolutionResult> {
    const tier = request.tier ?? 0;
    const requiredCapabilities = request.requiredCapabilities ?? [];

    const defaultRole = await findDefaultAgentRole(ctx, request.kind, tier);
    if (
      defaultRole &&
      matchesRequest(
        {
          ...defaultRole,
          capabilities: (defaultRole.capabilities as string[]) ?? [],
        },
        request.kind,
        tier,
        requiredCapabilities
      )
    ) {
      return {
        kind: request.kind,
        roleId: defaultRole.id,
        name: defaultRole.name,
        tier: defaultRole.tier as 0 | 1 | 2,
        provider: defaultRole.provider as AgentResolutionResult['provider'],
        model: defaultRole.model ?? undefined,
        capabilities: (defaultRole.capabilities as AgentCapability[]) ?? [],
      };
    }

    const allRoles = await listAgentRoles(ctx);
    const match = allRoles.find((role) =>
      matchesRequest(
        {
          ...role,
          capabilities: (role.capabilities as string[]) ?? [],
        },
        request.kind,
        tier,
        requiredCapabilities
      )
    );

    if (match) {
      return {
        kind: request.kind,
        roleId: match.id,
        name: match.name,
        tier: match.tier as 0 | 1 | 2,
        provider: match.provider as AgentResolutionResult['provider'],
        model: match.model ?? undefined,
        capabilities: (match.capabilities as AgentCapability[]) ?? [],
      };
    }

    // Fall back to built-in defaults so resolution never fails.
    const fallback = BUILT_IN_DEFAULTS.find((role) =>
      matchesRequest(
        { ...role, capabilities: role.capabilities ?? [] },
        request.kind,
        tier,
        requiredCapabilities
      )
    );

    if (fallback) {
      return {
        kind: request.kind,
        roleId: '00000000-0000-0000-0000-000000000000',
        name: fallback.name,
        tier: fallback.tier,
        provider: fallback.provider,
        model: fallback.model,
        capabilities: fallback.capabilities ?? [],
      };
    }

    throw new Error(
      `No agent role found for kind=${request.kind} tier=${tier} capabilities=${requiredCapabilities.join(',')}`
    );
  }
}

export const agentRoleRegistry = new AgentRoleRegistry();
