import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export type SsoProviderRow = typeof schema.ssoProvider.$inferSelect;
export type ScimTokenRow = typeof schema.scimToken.$inferSelect;

export async function createSsoProvider(
  ctx: TenantContext,
  input: {
    kind: 'saml' | 'oidc' | 'scim';
    name: string;
    status?: 'active' | 'inactive';
    config?: Record<string, unknown>;
  }
): Promise<SsoProviderRow> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.ssoProvider)
    .values({
      tenantId: ctx.tenantId,
      kind: input.kind,
      name: input.name,
      status: input.status ?? 'inactive',
      config: input.config ?? {},
    })
    .returning();
  return row;
}

export async function listSsoProviders(ctx: TenantContext): Promise<SsoProviderRow[]> {
  return ctx.tenantScopedDb.query.ssoProvider.findMany({
    where: eq(schema.ssoProvider.tenantId, ctx.tenantId),
    orderBy: (table, { desc }) => desc(table.updatedAt),
  });
}

export async function getSsoProviderById(
  ctx: TenantContext,
  id: string
): Promise<SsoProviderRow | undefined> {
  return ctx.tenantScopedDb.query.ssoProvider.findFirst({
    where: and(eq(schema.ssoProvider.tenantId, ctx.tenantId), eq(schema.ssoProvider.id, id)),
  });
}

export async function updateSsoProvider(
  ctx: TenantContext,
  id: string,
  input: Partial<{
    kind: 'saml' | 'oidc' | 'scim';
    name: string;
    status: 'active' | 'inactive';
    config: Record<string, unknown>;
  }>
): Promise<SsoProviderRow | undefined> {
  const [row] = await ctx.tenantScopedDb
    .update(schema.ssoProvider)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(schema.ssoProvider.tenantId, ctx.tenantId), eq(schema.ssoProvider.id, id)))
    .returning();
  return row;
}

export async function deleteSsoProvider(ctx: TenantContext, id: string): Promise<boolean> {
  const result = await ctx.tenantScopedDb
    .delete(schema.ssoProvider)
    .where(and(eq(schema.ssoProvider.tenantId, ctx.tenantId), eq(schema.ssoProvider.id, id)))
    .returning();
  return result.length > 0;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createScimToken(
  ctx: TenantContext,
  input: { providerId: string; name: string; token: string }
): Promise<ScimTokenRow> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.scimToken)
    .values({
      tenantId: ctx.tenantId,
      providerId: input.providerId,
      name: input.name,
      tokenHash: hashToken(input.token),
    })
    .returning();
  return row;
}

export async function getScimTokenByHash(
  ctx: TenantContext,
  token: string
): Promise<ScimTokenRow | undefined> {
  return ctx.tenantScopedDb.query.scimToken.findFirst({
    where: and(
      eq(schema.scimToken.tenantId, ctx.tenantId),
      eq(schema.scimToken.tokenHash, hashToken(token))
    ),
  });
}

export async function deleteScimToken(ctx: TenantContext, id: string): Promise<boolean> {
  const result = await ctx.tenantScopedDb
    .delete(schema.scimToken)
    .where(and(eq(schema.scimToken.tenantId, ctx.tenantId), eq(schema.scimToken.id, id)))
    .returning();
  return result.length > 0;
}
