import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export function generateApiKey(): string {
  return `mimir_${randomBytes(32).toString('base64url')}`;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export interface CreateDeviceInput {
  tenantId: string;
  ownerUserAccountId: string;
  kind: 'brain' | 'desktop' | 'cloud' | 'phone';
  name: string;
  tier: number;
  tailnetAddr?: string;
}

export async function createDevice(ctx: TenantContext, input: CreateDeviceInput) {
  const apiKey = generateApiKey();
  const id = randomUUID();

  await ctx.tenantScopedDb.insert(schema.node).values({
    id,
    tenantId: input.tenantId,
    ownerUserAccountId: input.ownerUserAccountId,
    kind: input.kind,
    name: input.name,
    tier: input.tier,
    tailnetAddr: input.tailnetAddr,
    apiKeyHash: hashApiKey(apiKey),
    status: 'up',
  });

  return { id, apiKey };
}

export async function findDeviceByApiKey(ctx: TenantContext, apiKey: string) {
  return ctx.tenantScopedDb.query.node.findFirst({
    where: eq(schema.node.apiKeyHash, hashApiKey(apiKey)),
  });
}

export async function findDeviceByApiKeyHash(apiKeyHash: string) {
  return db.query.node.findFirst({
    where: eq(schema.node.apiKeyHash, apiKeyHash),
  });
}

export async function rotateApiKey(ctx: TenantContext, nodeId: string) {
  const apiKey = generateApiKey();
  await ctx.tenantScopedDb
    .update(schema.node)
    .set({ apiKeyHash: hashApiKey(apiKey) })
    .where(eq(schema.node.id, nodeId));
  return { apiKey };
}
