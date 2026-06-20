import type { TenantContext } from '../../db/tenant-context';
import {
  type CreateDecisionInput,
  type CreateDecisionOutcomeInput,
  type CreateValueStatementInput,
  type UpdateValueStatementInput,
  archiveValueStatement,
  createDecision,
  createDecisionOutcome,
  createValueStatement,
  getDecisionById,
  getDecisionOutcomes,
  getValueStatementById,
  listDecisions,
  listValueStatements,
  updateValueStatement,
} from '../../repositories/values';

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'of',
  'for',
  'to',
  'in',
  'on',
  'at',
  'with',
  'by',
  'from',
  'as',
  'is',
  'it',
  'this',
  'that',
  'my',
  'our',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export interface AlignmentResult {
  score: number;
  rationale: string[];
}

export function computeDecisionAlignment(
  chosenOption: string,
  valueIds: string[],
  values: { id: string; name: string; description: string; weight: number }[]
): AlignmentResult {
  const chosenWords = new Set(tokenize(chosenOption));
  if (valueIds.length === 0 || chosenWords.size === 0) {
    return { score: 0, rationale: ['No values referenced or empty chosen option.'] };
  }

  const referencedValues = values.filter((value) => valueIds.includes(value.id));
  if (referencedValues.length === 0) {
    return { score: 0, rationale: ['Referenced values no longer exist.'] };
  }

  let totalWeight = 0;
  let matchedWeight = 0;
  const rationale: string[] = [];

  for (const value of referencedValues) {
    totalWeight += value.weight;
    const valueWords = new Set([...tokenize(value.name), ...tokenize(value.description)]);
    const hasMatch = [...valueWords].some((word) => chosenWords.has(word));
    if (hasMatch) {
      matchedWeight += value.weight;
      rationale.push(`Aligned with "${value.name}" (weight ${value.weight}).`);
    } else {
      rationale.push(`No clear keyword match with "${value.name}" (weight ${value.weight}).`);
    }
  }

  const score = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;
  return { score, rationale };
}

export async function getValues(ctx: TenantContext, appUserId: string) {
  return listValueStatements(ctx, appUserId);
}

export async function createValue(
  ctx: TenantContext,
  appUserId: string,
  input: Omit<CreateValueStatementInput, 'appUserId'>
) {
  return createValueStatement(ctx, { ...input, appUserId });
}

export async function updateValue(
  ctx: TenantContext,
  id: string,
  input: UpdateValueStatementInput
) {
  const updated = await updateValueStatement(ctx, id, input);
  if (!updated) throw new Error('Value not found');
  return updated;
}

export async function archiveValue(ctx: TenantContext, id: string) {
  const archived = await archiveValueStatement(ctx, id);
  if (!archived) throw new Error('Value not found');
  return archived;
}

export async function logDecision(
  ctx: TenantContext,
  appUserId: string,
  input: Omit<CreateDecisionInput, 'appUserId'>
) {
  return createDecision(ctx, { ...input, appUserId });
}

export async function recordOutcome(
  ctx: TenantContext,
  decisionId: string,
  input: Omit<CreateDecisionOutcomeInput, 'decisionId'>
) {
  const decision = await getDecisionById(ctx, decisionId);
  if (!decision) throw new Error('Decision not found');
  return createDecisionOutcome(ctx, { ...input, decisionId });
}

export async function getDecisionAlignment(ctx: TenantContext, decisionId: string) {
  const decision = await getDecisionById(ctx, decisionId);
  if (!decision) throw new Error('Decision not found');

  const values = await listValueStatements(ctx, decision.appUserId);
  const valueIds = (decision.valueIds as string[]) ?? [];
  return computeDecisionAlignment(decision.chosenOption, valueIds, values);
}

export async function getDecisions(ctx: TenantContext, appUserId: string) {
  return listDecisions(ctx, appUserId);
}

export async function getDecisionWithOutcomes(ctx: TenantContext, decisionId: string) {
  const decision = await getDecisionById(ctx, decisionId);
  if (!decision) return null;
  const outcomes = await getDecisionOutcomes(ctx, decisionId);
  return { decision, outcomes };
}

export async function getValueById(ctx: TenantContext, id: string) {
  return getValueStatementById(ctx, id);
}
