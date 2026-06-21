import type { MarketplaceItem } from '@mimir/shared-types';
import { and, eq } from 'drizzle-orm';
import { marketplaceInstall } from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export async function getInstalledItemIds(ctx: TenantContext, tenantId: string): Promise<string[]> {
  const rows = await ctx.tenantScopedDb
    .select({ itemId: marketplaceInstall.itemId })
    .from(marketplaceInstall)
    .where(eq(marketplaceInstall.tenantId, tenantId));
  return rows.map((r) => r.itemId);
}

export async function installItem(ctx: TenantContext, tenantId: string, item: MarketplaceItem) {
  const existing = await ctx.tenantScopedDb
    .select({ id: marketplaceInstall.id })
    .from(marketplaceInstall)
    .where(and(eq(marketplaceInstall.tenantId, tenantId), eq(marketplaceInstall.itemId, item.id)));
  if (existing.length > 0) {
    return existing[0];
  }
  const [row] = await ctx.tenantScopedDb
    .insert(marketplaceInstall)
    .values({
      tenantId,
      itemId: item.id,
    })
    .returning();
  return row;
}

export async function uninstallItem(ctx: TenantContext, tenantId: string, itemId: string) {
  await ctx.tenantScopedDb
    .delete(marketplaceInstall)
    .where(and(eq(marketplaceInstall.tenantId, tenantId), eq(marketplaceInstall.itemId, itemId)));
}
