import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export type ToolStatus = (typeof schema.toolStatusEnum.enumValues)[number];

export async function createTool(
  ctx: TenantContext,
  input: {
    name: string;
    description?: string;
    status?: ToolStatus;
    action: string;
    fields?: Record<string, unknown>[];
    enabled?: boolean;
  }
) {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.tool)
    .values({
      tenantId: ctx.tenantId,
      name: input.name,
      description: input.description ?? '',
      status: input.status ?? 'draft',
      action: input.action,
      fields: input.fields ?? [],
      enabled: input.enabled ?? true,
    })
    .returning();
  return row;
}

export async function listTools(
  ctx: TenantContext,
  options: { status?: ToolStatus; enabled?: boolean; limit?: number } = {}
) {
  const { status, enabled, limit = 100 } = options;
  return ctx.tenantScopedDb.query.tool.findMany({
    where: and(
      status ? eq(schema.tool.status, status) : undefined,
      enabled !== undefined ? eq(schema.tool.enabled, enabled) : undefined
    ),
    limit,
    orderBy: desc(schema.tool.updatedAt),
  });
}

export async function getToolById(ctx: TenantContext, id: string) {
  return ctx.tenantScopedDb.query.tool.findFirst({
    where: eq(schema.tool.id, id),
  });
}

export async function updateTool(
  ctx: TenantContext,
  id: string,
  input: Partial<{
    name: string;
    description: string;
    status: ToolStatus;
    action: string;
    fields: Record<string, unknown>[];
    enabled: boolean;
  }>
) {
  const [row] = await ctx.tenantScopedDb
    .update(schema.tool)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.tool.id, id))
    .returning();
  return row;
}

export async function deleteTool(ctx: TenantContext, id: string) {
  const result = await ctx.tenantScopedDb
    .delete(schema.tool)
    .where(eq(schema.tool.id, id))
    .returning();
  return result.length > 0;
}
