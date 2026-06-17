import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateConnectorInput {
  kind: (typeof schema.connector.kind.enumValues)[number];
  account?: string | null;
  scopes?: string[];
  tier: number;
  status?: (typeof schema.connector.status.enumValues)[number];
  secretRef: string;
}

export interface UpdateConnectorInput {
  account?: string | null;
  scopes?: string[];
  tier?: number;
  status?: (typeof schema.connector.status.enumValues)[number];
  secretRef?: string;
  lastSync?: Date;
}

export async function createConnector(
  ctx: TenantContext,
  input: CreateConnectorInput
): Promise<typeof schema.connector.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.connector)
    .values({
      tenantId: ctx.tenantId,
      kind: input.kind,
      account: input.account ?? null,
      scopes: input.scopes ?? [],
      tier: input.tier,
      status: input.status ?? 'connected',
      secretRef: input.secretRef,
    })
    .returning();
  return row;
}

export async function getConnectorById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.connector.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.connector)
    .where(eq(schema.connector.id, id));
  return row;
}

export async function findConnectorByKind(
  ctx: TenantContext,
  kind: (typeof schema.connector.kind.enumValues)[number]
): Promise<typeof schema.connector.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.connector)
    .where(eq(schema.connector.kind, kind));
  return row;
}

export async function listConnectors(
  ctx: TenantContext
): Promise<(typeof schema.connector.$inferSelect)[]> {
  return ctx.tenantScopedDb.select().from(schema.connector);
}

export async function updateConnector(
  ctx: TenantContext,
  id: string,
  input: UpdateConnectorInput
): Promise<typeof schema.connector.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .update(schema.connector)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(schema.connector.id, id))
    .returning();
  return row;
}

export async function deleteConnector(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.connector.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .delete(schema.connector)
    .where(eq(schema.connector.id, id))
    .returning();
  return row;
}
