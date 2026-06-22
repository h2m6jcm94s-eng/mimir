import { z } from 'zod';

export const SkillDraftStatus = z.enum(['draft', 'published', 'archived']);
export type SkillDraftStatus = z.infer<typeof SkillDraftStatus>;

export const CreateSkillDraftRequest = z.object({
  prompt: z.string().min(1).max(5000),
});
export type CreateSkillDraftRequest = z.infer<typeof CreateSkillDraftRequest>;

export const SkillDraft = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  prompt: z.string(),
  code: z.string().nullable(),
  payload: z.record(z.unknown()),
  status: SkillDraftStatus,
  installs: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SkillDraft = z.infer<typeof SkillDraft>;

export const SkillDraftListResponse = z.object({
  data: z.array(SkillDraft),
});
export type SkillDraftListResponse = z.infer<typeof SkillDraftListResponse>;

export const GeneratedSkillPayload = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000),
  code: z.string().max(20000),
  payload: z.record(z.unknown()).default({}),
});
export type GeneratedSkillPayload = z.infer<typeof GeneratedSkillPayload>;

export const GenerateSkillDraftResponse = z.object({
  data: SkillDraft,
});
export type GenerateSkillDraftResponse = z.infer<typeof GenerateSkillDraftResponse>;

export const PublishSkillDraftResponse = z.object({
  data: SkillDraft,
});
export type PublishSkillDraftResponse = z.infer<typeof PublishSkillDraftResponse>;
