import { z } from 'zod';

export const PersonalModuleKind = z.enum([
  'finance',
  'nutrition',
  'fitness',
  'travel',
  'tutor',
  'meeting',
  'email',
  'screenTime',
  'conversation',
  'suggestion',
  'family',
  'hr',
]);
export type PersonalModuleKind = z.infer<typeof PersonalModuleKind>;

export const PersonalModuleStatus = z.enum(['active', 'done', 'archived']);
export type PersonalModuleStatus = z.infer<typeof PersonalModuleStatus>;

export const CreatePersonalModuleRequest = z.object({
  kind: PersonalModuleKind,
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  status: PersonalModuleStatus.default('active'),
  dueAt: z.string().datetime().optional(),
  payload: z.record(z.unknown()).default({}),
});
export type CreatePersonalModuleRequest = z.infer<typeof CreatePersonalModuleRequest>;

export const UpdatePersonalModuleRequest = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: PersonalModuleStatus.optional(),
  dueAt: z.string().datetime().optional(),
  payload: z.record(z.unknown()).optional(),
});
export type UpdatePersonalModuleRequest = z.infer<typeof UpdatePersonalModuleRequest>;

export const PersonalModule = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  kind: PersonalModuleKind,
  title: z.string(),
  description: z.string().nullable(),
  status: PersonalModuleStatus,
  dueAt: z.string().datetime().nullable(),
  payload: z.record(z.unknown()),
  createdAt: z.string().datetime(),
});
export type PersonalModule = z.infer<typeof PersonalModule>;

export const ListPersonalModulesQuery = z.object({
  kind: PersonalModuleKind,
  status: PersonalModuleStatus.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListPersonalModulesQuery = z.infer<typeof ListPersonalModulesQuery>;

export const PersonalModuleListResponse = z.object({
  data: z.array(PersonalModule),
});
export type PersonalModuleListResponse = z.infer<typeof PersonalModuleListResponse>;
