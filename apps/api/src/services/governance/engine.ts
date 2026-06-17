import {
  type EvaluatePolicyRequest,
  type PolicyDecision,
  PolicyDocument,
  type PolicyRule,
} from '@mimir/shared-types';
import { parse as parseYaml } from 'yaml';
import type { TenantContext } from '../../db/tenant-context';
import { getTenantDailyCostUsd } from '../../repositories/job';
import { getActivePolicy } from '../../repositories/policy';

const MICROS_PER_DOLLAR = 1_000_000;

export class PolicyEngine {
  constructor(private readonly source: string) {}

  parse(): PolicyDocument {
    const parsed = parseYaml(this.source);
    const doc = Array.isArray(parsed) ? { rules: parsed } : parsed;
    return PolicyDocument.parse(doc);
  }

  evaluate(request: EvaluatePolicyRequest): PolicyDecision {
    let document: PolicyDocument;
    try {
      document = this.parse();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        effect: 'deny',
        reason: `Invalid policy: ${message}`,
      };
    }

    for (const rule of document.rules) {
      if (this.matches(rule, request)) {
        return {
          effect: rule.effect,
          reason: rule.reason,
          rule,
        };
      }
    }

    return {
      effect: 'allow',
      reason: 'No matching rules; default allow',
    };
  }

  private matches(rule: PolicyRule, request: EvaluatePolicyRequest): boolean {
    if (rule.action !== undefined && !matchPattern(rule.action, request.action)) {
      return false;
    }

    if (rule.kind !== undefined && rule.kind !== request.kind) {
      return false;
    }

    if (rule.tier !== undefined && rule.tier !== request.tier) {
      return false;
    }

    const condition = rule.when;
    if (!condition) {
      return true;
    }

    if (condition.action !== undefined && !matchPattern(condition.action, request.action)) {
      return false;
    }

    if (condition.kind !== undefined && condition.kind !== request.kind) {
      return false;
    }

    if (condition.tier !== undefined && condition.tier !== request.tier) {
      return false;
    }

    if (
      condition.dailySpendUsd !== undefined &&
      !compareNumber(condition.dailySpendUsd, request.dailySpendUsd)
    ) {
      return false;
    }

    return true;
  }
}

export async function evaluateTenantPolicy(
  ctx: TenantContext,
  request: Omit<EvaluatePolicyRequest, 'dailySpendUsd'>
): Promise<PolicyDecision> {
  const policy = await getActivePolicy(ctx);
  if (!policy || !policy.enabled) {
    return { effect: 'allow', reason: 'No active policy; default allow' };
  }

  const dailyCostUsd = await getTenantDailyCostUsd(ctx, new Date());
  const dailySpendUsd = dailyCostUsd / MICROS_PER_DOLLAR;
  const engine = new PolicyEngine(policy.source);
  return engine.evaluate({ ...request, dailySpendUsd });
}

function matchPattern(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  return pattern === value;
}

function compareNumber(expression: string, value: number): boolean {
  const trimmed = expression.trim();
  const match = trimmed.match(/^(>=|<=|>|<|==)?\s*([\d.]+)$/);
  if (!match) {
    return false;
  }

  const operator = match[1] ?? '==';
  const operand = Number.parseFloat(match[2]);
  if (Number.isNaN(operand)) {
    return false;
  }

  switch (operator) {
    case '>':
      return value > operand;
    case '>=':
      return value >= operand;
    case '<':
      return value < operand;
    case '<=':
      return value <= operand;
    case '==':
      return value === operand;
    default:
      return false;
  }
}
