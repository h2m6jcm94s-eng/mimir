import type { TenantContext } from '../../db/tenant-context';
import {
  type CreateRemediationInput,
  createRemediationRun,
  updateRemediationRun,
} from '../../repositories/remediation';
import { ModelRouter } from '../models/router';

function buildRemediationPrompt(input: CreateRemediationInput): string {
  return `You are Mimir's self-healing remediation agent. A system issue was detected.

Return ONLY a raw JSON object with no markdown fences. Use this schema:
{
  "action": "concrete remediation step",
  "output": { "notes": "additional context" }
}

Target type: ${input.targetType}
Target id: ${input.targetId}
Issue: ${input.issue}`;
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export async function runRemediation(
  ctx: TenantContext,
  input: CreateRemediationInput
): Promise<typeof import('../../db/schema').remediationRun.$inferSelect> {
  const run = await createRemediationRun(ctx, { ...input, status: 'running' });

  const router = new ModelRouter();
  let action: string;
  let output: Record<string, unknown>;

  try {
    const modelOutput = await router.invoke(
      1,
      { prompt: buildRemediationPrompt(input), payload: {} },
      { ctx, maxTokens: 600 }
    );
    const cleaned = stripMarkdownFences(modelOutput.text ?? '{}');
    const parsed = JSON.parse(cleaned);
    action =
      typeof parsed.action === 'string'
        ? parsed.action
        : 'Investigate and restart affected service.';
    output = typeof parsed.output === 'object' && parsed.output !== null ? parsed.output : {};
  } catch {
    action = 'Investigate and restart affected service.';
    output = { notes: 'Model did not return a parseable remediation plan; fallback action used.' };
  }

  const updated = await updateRemediationRun(ctx, run.id, {
    status: 'resolved',
    action,
    output,
  });
  if (!updated) {
    throw new Error('Remediation run disappeared during processing');
  }
  return updated;
}
