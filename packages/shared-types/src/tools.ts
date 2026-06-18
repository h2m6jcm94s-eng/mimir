import { z } from 'zod';

export const ToolStatus = z.enum(['draft', 'active', 'archived']);
export type ToolStatus = z.infer<typeof ToolStatus>;

export const ToolFieldType = z.enum(['string', 'number', 'boolean']);
export type ToolFieldType = z.infer<typeof ToolFieldType>;

export const ToolField = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: ToolFieldType,
  required: z.boolean().default(false),
});
export type ToolField = z.infer<typeof ToolField>;

export const Tool = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  status: ToolStatus,
  action: z.string().min(1),
  fields: z.array(ToolField).default([]),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Tool = z.infer<typeof Tool>;

export const CreateToolRequest = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
  status: ToolStatus.default('draft'),
  action: z.string().min(1),
  fields: z.array(ToolField).default([]),
  enabled: z.boolean().default(true),
});
export type CreateToolRequest = z.infer<typeof CreateToolRequest>;

export const UpdateToolRequest = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: ToolStatus.optional(),
  action: z.string().min(1).optional(),
  fields: z.array(ToolField).optional(),
  enabled: z.boolean().optional(),
});
export type UpdateToolRequest = z.infer<typeof UpdateToolRequest>;

export const RunToolRequest = z.object({
  input: z.record(z.unknown()).default({}),
});
export type RunToolRequest = z.infer<typeof RunToolRequest>;

export const RunToolResponse = z.object({
  result: z.record(z.unknown()),
});
export type RunToolResponse = z.infer<typeof RunToolResponse>;
