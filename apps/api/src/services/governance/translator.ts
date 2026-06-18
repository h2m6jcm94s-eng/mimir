import type { ModelInput, ModelOutput } from '@mimir/shared-types';
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
}

const CODE_BLOCK_REGEX = /```(?:yaml|yml)?\n([\s\S]*?)```/;

function extractAction(text: string): string | undefined {
  const quoted = text.match(/["']([^"']+)["']/);
  if (quoted) return quoted[1];
  const match = text.match(/(?:for|on)\s+(\S+)/);
  return match?.[1];
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

function parseSentence(sentence: string): string | undefined {
  const lower = sentence.toLowerCase().trim();
  if (!lower) return undefined;

  if (lower.includes('require approval')) {
    const action = extractAction(sentence) ?? '*';
    return `- action: "${action}"\n  effect: require_approval\n  reason: requires human approval`;
  }

  if (lower.includes('deny')) {
    const action = extractAction(sentence);
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

function heuristicTranslate(description: string): string | undefined {
  const sentences = description
    .split(/\n|(?:\.\s+)/)
    .map((s) => s.trim())
    .filter(Boolean);
  const rules: string[] = [];
  for (const sentence of sentences) {
    const rule = parseSentence(sentence);
    if (rule) rules.push(rule);
  }
  if (rules.length === 0) return undefined;
  return `rules:\n${rules.map((r) => r.replace(/^/gm, '  ')).join('\n')}\n`;
}

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

Natural-language policy: """${description}"""`;

  const output = await invokeModel({ prompt, payload: {} });
  const match = CODE_BLOCK_REGEX.exec(output.text);
  const candidate = match?.[1]?.trim() ?? output.text.trim();
  return candidate;
}

export async function translatePolicy(
  description: string,
  options: TranslatePolicyOptions = {}
): Promise<string> {
  let source = heuristicTranslate(description);

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

  return source;
}
