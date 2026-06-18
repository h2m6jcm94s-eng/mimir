import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface ScimUserInput {
  userName: string;
  emails?: Array<{ value: string; primary?: boolean }>;
  name?: {
    givenName?: string;
    familyName?: string;
    formatted?: string;
  };
  active?: boolean;
}

export interface ScimUserRecord {
  appUserId: string;
  userAccountId: string;
  email: string;
  userName: string;
  name?: {
    givenName?: string;
    familyName?: string;
    formatted?: string;
  };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function pickPrimaryEmail(input: ScimUserInput): string {
  if (input.emails && input.emails.length > 0) {
    const primary = input.emails.find((e) => e.primary);
    return (primary ?? input.emails[0]).value;
  }
  return input.userName;
}

async function fetchUserAccount(userAccountId: string) {
  return db.query.userAccount.findFirst({
    where: eq(schema.userAccount.id, userAccountId),
  });
}

function toRecord(
  membership: typeof schema.appUser.$inferSelect,
  email: string,
  name?: ScimUserInput['name']
): ScimUserRecord {
  return {
    appUserId: membership.id,
    userAccountId: membership.userAccountId,
    email,
    userName: email,
    name,
    active: membership.active,
    createdAt: membership.createdAt,
    updatedAt: membership.createdAt,
  };
}

export async function listScimUsers(
  ctx: TenantContext,
  options: { startIndex?: number; count?: number }
): Promise<{ users: ScimUserRecord[]; total: number }> {
  const all = await ctx.tenantScopedDb.query.appUser.findMany({
    where: eq(schema.appUser.tenantId, ctx.tenantId),
  });

  const records: ScimUserRecord[] = [];
  for (const membership of all) {
    const account = await fetchUserAccount(membership.userAccountId);
    if (!account) continue;
    records.push(toRecord(membership, account.email));
  }

  const start = Math.max((options.startIndex ?? 1) - 1, 0);
  const count = options.count ?? records.length;
  return { users: records.slice(start, start + count), total: records.length };
}

export async function getScimUserById(
  ctx: TenantContext,
  id: string
): Promise<ScimUserRecord | undefined> {
  const membership = await ctx.tenantScopedDb.query.appUser.findFirst({
    where: eq(schema.appUser.id, id),
  });

  if (!membership) return undefined;
  const account = await fetchUserAccount(membership.userAccountId);
  if (!account) return undefined;

  return toRecord(membership, account.email);
}

export async function createScimUser(
  ctx: TenantContext,
  input: ScimUserInput
): Promise<ScimUserRecord> {
  const email = pickPrimaryEmail(input);

  let userAccount = await db.query.userAccount.findFirst({
    where: eq(schema.userAccount.email, email),
  });

  if (!userAccount) {
    const accountId = randomUUID();
    [userAccount] = await db
      .insert(schema.userAccount)
      .values({
        id: accountId,
        externalId: `scim:${accountId}`,
        email,
      })
      .returning();
  }

  const existingMembership = await ctx.tenantScopedDb.query.appUser.findFirst({
    where: eq(schema.appUser.userAccountId, userAccount.id),
  });

  if (existingMembership) {
    throw new Error('User already exists in this tenant');
  }

  const [membership] = await ctx.tenantScopedDb
    .insert(schema.appUser)
    .values({
      tenantId: ctx.tenantId,
      userAccountId: userAccount.id,
      role: 'member',
      active: input.active ?? true,
    })
    .returning();

  return toRecord(membership, userAccount.email, input.name);
}

export async function replaceScimUser(
  ctx: TenantContext,
  id: string,
  input: ScimUserInput
): Promise<ScimUserRecord | undefined> {
  const membership = await ctx.tenantScopedDb.query.appUser.findFirst({
    where: eq(schema.appUser.id, id),
  });

  if (!membership) return undefined;

  const currentAccount = await fetchUserAccount(membership.userAccountId);
  if (!currentAccount) throw new Error('User account missing');

  const email = pickPrimaryEmail(input);
  if (email !== currentAccount.email) {
    const existing = await db.query.userAccount.findFirst({
      where: eq(schema.userAccount.email, email),
    });
    if (existing && existing.id !== membership.userAccountId) {
      throw new Error('Email already in use');
    }
  }

  await db
    .update(schema.userAccount)
    .set({ email })
    .where(eq(schema.userAccount.id, membership.userAccountId));

  const [updatedMembership] = await ctx.tenantScopedDb
    .update(schema.appUser)
    .set({ active: input.active ?? true })
    .where(eq(schema.appUser.id, id))
    .returning();

  const userAccount = await fetchUserAccount(updatedMembership.userAccountId);
  if (!userAccount) throw new Error('User account missing');

  return toRecord(updatedMembership, userAccount.email, input.name);
}

export async function setScimUserActive(
  ctx: TenantContext,
  id: string,
  active: boolean
): Promise<ScimUserRecord | undefined> {
  const [membership] = await ctx.tenantScopedDb
    .update(schema.appUser)
    .set({ active })
    .where(eq(schema.appUser.id, id))
    .returning();

  if (!membership) return undefined;
  const userAccount = await fetchUserAccount(membership.userAccountId);
  if (!userAccount) throw new Error('User account missing');

  return toRecord(membership, userAccount.email);
}

export async function deleteScimUser(ctx: TenantContext, id: string): Promise<boolean> {
  const result = await ctx.tenantScopedDb
    .delete(schema.appUser)
    .where(eq(schema.appUser.id, id))
    .returning();
  return result.length > 0;
}
