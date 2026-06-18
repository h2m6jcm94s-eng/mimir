import type { ModelInput, ModelOutput, PolicyRule } from '@mimir/shared-types';
import { PolicyEngine } from './engine';

export class PolicyTranslationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyTranslationError';
  }
}

export interface TranslatePolicyOptions {
  /** Optional model invoker for descriptions not covered by the heuristic parser. */
  invokeModel?: (input: ModelInput) => Promise<ModelOutput>;
  /** Optional canonical action dictionary used to fuzzy-match extracted action names. */
  knownActions?: string[];
}

export interface TranslatePolicyResult {
  source: string;
  explanations: string[];
}

const CODE_BLOCK_REGEX = /```(?:yaml|yml)?\n([\s\S]*?)```/;

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function findBestActionMatch(raw: string, candidates: string[]): string | undefined {
  const normalizedRaw = raw.toLowerCase();
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = levenshtein(normalizedRaw, candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  if (!best) return undefined;
  // Conservative threshold: allow up to 2 edits, and never more than a third of the raw length.
  if (bestDistance <= 2 && bestDistance <= normalizedRaw.length / 3) return best;
  return undefined;
}

function extractAction(text: string, knownActions?: string[]): string | undefined {
  const quoted = text.match(/["']([^"']+)["']/);
  const raw = quoted?.[1] ?? text.match(/(?:for|on)\s+(\S+)/)?.[1];
  if (!raw) return undefined;
  const cleaned = raw.replace(/[.,;:!?]+$/, '');
  if (knownActions && knownActions.length > 0) {
    const match = findBestActionMatch(cleaned, knownActions);
    if (match) return match;
  }
  return cleaned;
}

function extractNumber(text: string): number | undefined {
  const match = text.match(/[\d.]+/);
  if (!match) return undefined;
  const value = Number.parseFloat(match[0]);
  return Number.isNaN(value) ? undefined : value;
}

function extractTier(text: string): 0 | 1 | 2 | undefined {
  const match = text.match(/tier\s*(?:is\s*)?(\d)/i);
  if (!match) return undefined;
  const tier = Number.parseInt(match[1], 10);
  if (tier === 0 || tier === 1 || tier === 2) return tier;
  return undefined;
}

function parseSentence(sentence: string, knownActions?: string[]): string | undefined {
  const lower = sentence.toLowerCase().trim();
  if (!lower) return undefined;

  if (lower.includes('require approval')) {
    const action = extractAction(sentence, knownActions) ?? '*';
    return `- action: "${action}"\n  effect: require_approval\n  reason: requires human approval`;
  }

  if (/^(deny\s+all|deny\s+everything|default\s+deny)/i.test(lower)) {
    return `- action: "*"\n  effect: deny\n  reason: default deny`;
  }

  if (lower.includes('deny')) {
    const action = extractAction(sentence, knownActions);
    const tier = extractTier(sentence);
    const amount =
      lower.includes('daily spend') || lower.includes('spend')
        ? extractNumber(sentence)
        : undefined;

    if (action || tier !== undefined || amount !== undefined) {
      const lines: string[] = [];
      lines.push(`- action: "${action ?? '*'}"`);
      lines.push('  effect: deny');
      if (tier !== undefined || amount !== undefined) {
        lines.push('  when:');
        if (tier !== undefined) lines.push(`    tier: ${tier}`);
        if (amount !== undefined) lines.push(`    dailySpendUsd: '> ${amount.toFixed(2)}'`);
      }
      lines.push('  reason: denied by natural-language policy');
      return lines.join('\n');
    }
  }

  if (/^(allow\s+all|allow\s+everything|default\s+allow)/i.test(lower)) {
    return `- action: "*"\n  effect: allow\n  reason: default allow`;
  }

  return undefined;
}

function heuristicTranslate(description: string, knownActions?: string[]): string | undefined {
  const sentences = description
    .split(/\n|(?:\.\s+)/)
    .map((s) => s.trim())
    .filter(Boolean);
  const rules: string[] = [];
  for (const sentence of sentences) {
    const rule = parseSentence(sentence, knownActions);
    if (rule) rules.push(rule);
  }
  if (rules.length === 0) return undefined;
  return `rules:\n${rules.map((r) => r.replace(/^/gm, '  ')).join('\n')}\n`;
}

function operatorDescription(expression: string): string {
  const trimmed = expression.trim();
  const match = trimmed.match(/^(>=|<=|>|<|==)?\s*([\d.]+)$/);
  if (!match) return `is ${trimmed}`;
  const operator = match[1] ?? '==';
  const amount = match[2];
  switch (operator) {
    case '>':
      return `greater than ${amount}`;
    case '>=':
      return `greater than or equal to ${amount}`;
    case '<':
      return `less than ${amount}`;
    case '<=':
      return `less than or equal to ${amount}`;
    case '==':
      return `equals ${amount}`;
    default:
      return `is ${trimmed}`;
  }
}

function explainRule(rule: PolicyRule): string {
  const actionLabel =
    rule.action === '*' || rule.action === undefined ? 'all actions' : rule.action;
  const parts: string[] = [];
  if (rule.kind) parts.push(`kind is ${rule.kind}`);
  if (rule.when?.tier !== undefined) parts.push(`tier is ${rule.when.tier}`);
  if (rule.when?.dailySpendUsd !== undefined)
    parts.push(`daily spend is ${operatorDescription(rule.when.dailySpendUsd)}`);

  const condition = parts.length > 0 ? ` when ${parts.join(' and ')}` : '';

  switch (rule.effect) {
    case 'allow':
      return `Allow ${actionLabel}${condition}.`;
    case 'deny':
      return `Deny ${actionLabel}${condition}.`;
    case 'require_approval':
      return `Require approval for ${actionLabel}${condition}.`;
    default:
      return `${rule.effect} ${actionLabel}${condition}.`;
  }
}

export function explainPolicy(source: string): string[] {
  const document = new PolicyEngine(source).parse();
  return document.rules.map(explainRule);
}

const POLICY_EXAMPLES = `
Example 1:
Input: "Require approval for github.openPr"
Output:
rules:
  - action: "github.openPr"
    effect: require_approval
    reason: opening a PR requires human approval

Example 2:
Input: "Deny tier 2 actions when daily spend is greater than 5.00"
Output:
rules:
  - action: "*"
    effect: deny
    when:
      tier: 2
      dailySpendUsd: '> 5.00'
    reason: daily cloud spend limit exceeded

Example 3:
Input: "Allow everything else"
Output:
rules:
  - action: "*"
    effect: allow
    reason: default allow
`;

async function modelTranslate(
  description: string,
  invokeModel: (input: ModelInput) => Promise<ModelOutput>
): Promise<string> {
  const prompt = `Convert the following natural-language governance policy into a YAML policy document for the Mimir policy engine.

The output must be a single YAML code block using this schema:

rules:
  - action: <action or '*'>
    effect: allow | deny | require_approval
    reason: <human-readable reason>
    when: # optional
      tier: 0 | 1 | 2
      dailySpendUsd: '<operator> <amount>' # e.g. '> 1.00'

Rules are evaluated top-down; the first matching rule wins. End with a default allow rule if appropriate.
${POLICY_EXAMPLES}
Natural-language policy: """${description}"""`;

  const output = await invokeModel({ prompt, payload: {} });
  const match = CODE_BLOCK_REGEX.exec(output.text);
  const candidate = match?.[1]?.trim() ?? output.text.trim();
  return candidate;
}

export async function translatePolicy(
  description: string,
  options: TranslatePolicyOptions = {}
): Promise<TranslatePolicyResult> {
  let source = heuristicTranslate(description, options.knownActions);

  if (!source && options.invokeModel) {
    source = await modelTranslate(description, options.invokeModel);
  }

  if (!source) {
    throw new PolicyTranslationError('Could not translate description into a policy');
  }

  try {
    new PolicyEngine(source).parse();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new PolicyTranslationError(`Translated policy is invalid: ${message}`);
  }

  const explanations = explainPolicy(source);
  return { source, explanations };
}
