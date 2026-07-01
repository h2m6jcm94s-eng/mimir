import { GeneratedSkillPayload } from '@mimir/shared-types';
import type { TenantContext } from '../../db/tenant-context';
import { createSkillDraft } from '../../repositories/skills';
import { getModelRouter } from '../models/router';

function buildSkillGenerationPrompt(userPrompt: string): string {
  return `You are Mimir's self-building skill agent. Design a small, composable Mimir skill based on the user request.

Return ONLY a raw JSON object with no markdown fences. Use this exact schema:
{
  "name": "kebab-case-skill-name",
  "description": "One-sentence description of what the skill does.",
  "code": "export default defineSkill({...}); // valid TypeScript skill module",
  "payload": { "tags": ["tag1", "tag2"], "icon": "Wand2" }
}

User request: ${userPrompt}`;
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export async function generateSkillDraft(
  ctx: TenantContext,
  prompt: string
): Promise<typeof import('../../db/schema').skillDraft.$inferSelect> {
  const router = getModelRouter();
  const output = await router.invoke(
    1,
    { prompt: buildSkillGenerationPrompt(prompt), payload: {} },
    { ctx, maxTokens: 1500 }
  );

  const cleaned = stripMarkdownFences(output.text ?? '{}');

  const fallback: import('@mimir/shared-types').GeneratedSkillPayload = {
    name: `skill-${Date.now()}`,
    description: prompt,
    code: `// Auto-generated skill for: ${prompt}\nexport default defineSkill({\n  name: 'generated-skill',\n  triggers: [{ type: 'command', value: '/generated-skill' }],\n  actions: [{ type: 'prompt', model: 'kimi' }],\n  outputs: ['text'],\n});`,
    payload: { tags: ['generated'], icon: 'Wand2' },
  };

  let generated: import('@mimir/shared-types').GeneratedSkillPayload;
  try {
    const parsed = JSON.parse(cleaned);
    generated = GeneratedSkillPayload.parse(parsed);
  } catch {
    generated = fallback;
  }

  return createSkillDraft(ctx, {
    name: generated.name,
    description: generated.description,
    prompt,
    code: generated.code,
    payload: generated.payload,
  });
}
