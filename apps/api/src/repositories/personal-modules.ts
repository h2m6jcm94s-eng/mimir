import { and, desc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export type PersonalModuleKind = (typeof schema.personalModule.$inferSelect)['kind'];
export type PersonalModuleStatus = (typeof schema.personalModule.$inferSelect)['status'];
export type PersonalModuleRow = typeof schema.personalModule.$inferSelect;

export interface CreatePersonalModuleInput {
  kind: PersonalModuleKind;
  title: string;
  description?: string;
  status?: PersonalModuleStatus;
  dueAt?: string;
  payload?: Record<string, unknown>;
}

export interface UpdatePersonalModuleInput {
  title?: string;
  description?: string;
  status?: PersonalModuleStatus;
  dueAt?: string;
  payload?: Record<string, unknown>;
}

export interface ListPersonalModulesOptions {
  kind: PersonalModuleKind;
  status?: PersonalModuleStatus;
  limit: number;
}

export async function createPersonalModule(
  ctx: TenantContext,
  input: CreatePersonalModuleInput
): Promise<PersonalModuleRow> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.personalModule)
    .values({
      tenantId: ctx.tenantId,
      kind: input.kind,
      title: input.title,
      description: input.description,
      status: input.status ?? 'active',
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      payload: input.payload ?? {},
    })
    .returning();
  return row;
}

export async function getPersonalModuleById(
  ctx: TenantContext,
  id: string
): Promise<PersonalModuleRow | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.personalModule)
    .where(and(eq(schema.personalModule.id, id), eq(schema.personalModule.tenantId, ctx.tenantId)))
    .limit(1);
  return row;
}

export async function listPersonalModules(
  ctx: TenantContext,
  options: ListPersonalModulesOptions
): Promise<PersonalModuleRow[]> {
  const conditions = [
    eq(schema.personalModule.tenantId, ctx.tenantId),
    eq(schema.personalModule.kind, options.kind),
  ];

  if (options.status) {
    conditions.push(eq(schema.personalModule.status, options.status));
  }

  return ctx.tenantScopedDb
    .select()
    .from(schema.personalModule)
    .where(and(...conditions))
    .orderBy(desc(schema.personalModule.createdAt))
    .limit(options.limit);
}

export async function updatePersonalModule(
  ctx: TenantContext,
  id: string,
  input: UpdatePersonalModuleInput
): Promise<PersonalModuleRow | undefined> {
  const [row] = await ctx.tenantScopedDb
    .update(schema.personalModule)
    .set({
      title: input.title,
      description: input.description,
      status: input.status,
      dueAt: input.dueAt === undefined ? undefined : input.dueAt ? new Date(input.dueAt) : null,
      payload: input.payload,
    })
    .where(and(eq(schema.personalModule.id, id), eq(schema.personalModule.tenantId, ctx.tenantId)))
    .returning();
  return row;
}

export async function deletePersonalModule(
  ctx: TenantContext,
  id: string
): Promise<PersonalModuleRow | undefined> {
  const [row] = await ctx.tenantScopedDb
    .delete(schema.personalModule)
    .where(and(eq(schema.personalModule.id, id), eq(schema.personalModule.tenantId, ctx.tenantId)))
    .returning();
  return row;
}
