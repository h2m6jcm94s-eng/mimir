import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { TenantContext } from '../db/tenant-context';

export interface CreateMemoryNodeInput {
  kind: (typeof schema.memoryNodeKindEnum.enumValues)[number];
  key: string;
  value: Record<string, unknown>;
  createdBy?: string;
  sourceId?: string;
}

export interface UpdateMemoryNodeInput {
  value: Record<string, unknown>;
}

export interface CreateMemoryEdgeInput {
  sourceId: string;
  targetId: string;
  rel?: string;
  weight?: number;
}

export interface CreateMemoryCheckpointInput {
  label: string;
  createdBy?: string;
  parentId?: string;
}

export async function createMemoryNode(
  ctx: TenantContext,
  input: CreateMemoryNodeInput
): Promise<typeof schema.memoryNode.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.memoryNode)
    .values({
      tenantId: ctx.tenantId,
      kind: input.kind,
      key: input.key,
      value: input.value,
      createdBy: input.createdBy,
      sourceId: input.sourceId,
    })
    .returning();
  return row;
}

export async function getActiveMemoryNodeById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.memoryNode.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.memoryNode)
    .where(
      and(
        eq(schema.memoryNode.id, id),
        eq(schema.memoryNode.tenantId, ctx.tenantId),
        isNull(schema.memoryNode.validTo)
      )
    );
  return row;
}

export async function updateMemoryNode(
  ctx: TenantContext,
  id: string,
  input: UpdateMemoryNodeInput
): Promise<typeof schema.memoryNode.$inferSelect | undefined> {
  const now = new Date();
  const existing = await getActiveMemoryNodeById(ctx, id);
  if (!existing) return undefined;

  await ctx.tenantScopedDb
    .update(schema.memoryNode)
    .set({ validTo: now })
    .where(and(eq(schema.memoryNode.id, id), eq(schema.memoryNode.tenantId, ctx.tenantId)));

  const [row] = await ctx.tenantScopedDb
    .insert(schema.memoryNode)
    .values({
      tenantId: ctx.tenantId,
      kind: existing.kind,
      key: existing.key,
      value: input.value,
      validFrom: now,
      createdBy: existing.createdBy,
      sourceId: existing.sourceId,
    })
    .returning();
  return row;
}

export async function listActiveMemoryNodes(
  ctx: TenantContext,
  input: { limit: number }
): Promise<(typeof schema.memoryNode.$inferSelect)[]> {
  return ctx.tenantScopedDb
    .select()
    .from(schema.memoryNode)
    .where(and(eq(schema.memoryNode.tenantId, ctx.tenantId), isNull(schema.memoryNode.validTo)))
    .orderBy(desc(schema.memoryNode.createdAt))
    .limit(input.limit);
}

export async function listActiveMemoryNodesByKind(
  ctx: TenantContext,
  input: { kind: CreateMemoryNodeInput['kind']; limit: number }
): Promise<(typeof schema.memoryNode.$inferSelect)[]> {
  return ctx.tenantScopedDb
    .select()
    .from(schema.memoryNode)
    .where(
      and(
        eq(schema.memoryNode.tenantId, ctx.tenantId),
        eq(schema.memoryNode.kind, input.kind),
        isNull(schema.memoryNode.validTo)
      )
    )
    .orderBy(desc(schema.memoryNode.createdAt))
    .limit(input.limit);
}

export async function createMemoryEdge(
  ctx: TenantContext,
  input: CreateMemoryEdgeInput
): Promise<typeof schema.memoryEdge.$inferSelect> {
  const [row] = await ctx.tenantScopedDb
    .insert(schema.memoryEdge)
    .values({
      tenantId: ctx.tenantId,
      sourceId: input.sourceId,
      targetId: input.targetId,
      rel: input.rel ?? 'relates_to',
      weight: input.weight ?? 1,
    })
    .returning();
  return row;
}

export async function deleteMemoryEdge(ctx: TenantContext, id: string): Promise<boolean> {
  const result = await ctx.tenantScopedDb
    .update(schema.memoryEdge)
    .set({ validTo: new Date() })
    .where(
      and(
        eq(schema.memoryEdge.id, id),
        eq(schema.memoryEdge.tenantId, ctx.tenantId),
        isNull(schema.memoryEdge.validTo)
      )
    )
    .returning();
  return result.length > 0;
}

export async function listActiveMemoryEdges(
  ctx: TenantContext,
  input: { nodeIds?: string[]; limit: number }
): Promise<(typeof schema.memoryEdge.$inferSelect)[]> {
  const conditions = [
    eq(schema.memoryEdge.tenantId, ctx.tenantId),
    isNull(schema.memoryEdge.validTo),
  ];
  if (input.nodeIds && input.nodeIds.length > 0) {
    conditions.push(inArray(schema.memoryEdge.sourceId, input.nodeIds));
    conditions.push(inArray(schema.memoryEdge.targetId, input.nodeIds));
  }
  return ctx.tenantScopedDb
    .select()
    .from(schema.memoryEdge)
    .where(and(...conditions))
    .limit(input.limit);
}

export async function getMemoryGraph(
  ctx: TenantContext,
  input: { limit: number }
): Promise<{
  nodes: (typeof schema.memoryNode.$inferSelect)[];
  edges: (typeof schema.memoryEdge.$inferSelect)[];
}> {
  const nodes = await listActiveMemoryNodes(ctx, input);
  const nodeIds = nodes.map((n) => n.id);
  const edges =
    nodeIds.length > 0 ? await listActiveMemoryEdges(ctx, { nodeIds, limit: input.limit }) : [];
  return { nodes, edges };
}

export async function getMemoryNodesByIds(
  ctx: TenantContext,
  ids: string[]
): Promise<(typeof schema.memoryNode.$inferSelect)[]> {
  if (ids.length === 0) return [];
  return ctx.tenantScopedDb
    .select()
    .from(schema.memoryNode)
    .where(and(eq(schema.memoryNode.tenantId, ctx.tenantId), inArray(schema.memoryNode.id, ids)));
}

export async function getMemoryEdgesByIds(
  ctx: TenantContext,
  ids: string[]
): Promise<(typeof schema.memoryEdge.$inferSelect)[]> {
  if (ids.length === 0) return [];
  return ctx.tenantScopedDb
    .select()
    .from(schema.memoryEdge)
    .where(and(eq(schema.memoryEdge.tenantId, ctx.tenantId), inArray(schema.memoryEdge.id, ids)));
}

export async function createMemoryCheckpoint(
  ctx: TenantContext,
  input: CreateMemoryCheckpointInput
): Promise<typeof schema.memoryCheckpoint.$inferSelect> {
  const { nodes, edges } = await getMemoryGraph(ctx, { limit: 10_000 });
  const [row] = await ctx.tenantScopedDb
    .insert(schema.memoryCheckpoint)
    .values({
      tenantId: ctx.tenantId,
      label: input.label,
      createdBy: input.createdBy,
      parentId: input.parentId,
      nodeSnapshot: nodes.map((n) => n.id),
      edgeSnapshot: edges.map((e) => e.id),
    })
    .returning();
  return row;
}

export async function getMemoryCheckpointById(
  ctx: TenantContext,
  id: string
): Promise<typeof schema.memoryCheckpoint.$inferSelect | undefined> {
  const [row] = await ctx.tenantScopedDb
    .select()
    .from(schema.memoryCheckpoint)
    .where(
      and(eq(schema.memoryCheckpoint.id, id), eq(schema.memoryCheckpoint.tenantId, ctx.tenantId))
    );
  return row;
}

export async function listMemoryCheckpoints(
  ctx: TenantContext,
  input: { limit: number }
): Promise<(typeof schema.memoryCheckpoint.$inferSelect)[]> {
  return ctx.tenantScopedDb
    .select()
    .from(schema.memoryCheckpoint)
    .where(eq(schema.memoryCheckpoint.tenantId, ctx.tenantId))
    .orderBy(desc(schema.memoryCheckpoint.createdAt))
    .limit(input.limit);
}

function normalizeValue(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export async function diffMemoryCheckpoints(
  ctx: TenantContext,
  leftId: string,
  rightId: string
): Promise<{
  addedNodes: (typeof schema.memoryNode.$inferSelect)[];
  removedNodes: (typeof schema.memoryNode.$inferSelect)[];
  changedNodes: {
    id: string;
    before: typeof schema.memoryNode.$inferSelect;
    after: typeof schema.memoryNode.$inferSelect;
  }[];
  addedEdges: (typeof schema.memoryEdge.$inferSelect)[];
  removedEdges: (typeof schema.memoryEdge.$inferSelect)[];
}> {
  const [left, right] = await Promise.all([
    getMemoryCheckpointById(ctx, leftId),
    getMemoryCheckpointById(ctx, rightId),
  ]);
  if (!left || !right) {
    throw new Error('Checkpoint not found');
  }

  const leftNodeIds = (left.nodeSnapshot as string[]) ?? [];
  const rightNodeIds = (right.nodeSnapshot as string[]) ?? [];
  const leftEdgeIds = (left.edgeSnapshot as string[]) ?? [];
  const rightEdgeIds = (right.edgeSnapshot as string[]) ?? [];

  const [leftNodes, rightNodes, leftEdges, rightEdges] = await Promise.all([
    getMemoryNodesByIds(ctx, leftNodeIds),
    getMemoryNodesByIds(ctx, rightNodeIds),
    getMemoryEdgesByIds(ctx, leftEdgeIds),
    getMemoryEdgesByIds(ctx, rightEdgeIds),
  ]);

  const leftNodeMap = new Map(leftNodes.map((n) => [n.id, n]));
  const rightNodeMap = new Map(rightNodes.map((n) => [n.id, n]));
  const leftEdgeMap = new Map(leftEdges.map((e) => [e.id, e]));
  const rightEdgeMap = new Map(rightEdges.map((e) => [e.id, e]));

  const addedNodes = rightNodes.filter((n) => !leftNodeMap.has(n.id));
  const removedNodes = leftNodes.filter((n) => !rightNodeMap.has(n.id));
  const changedNodes = leftNodes
    .map((before) => {
      const after = rightNodeMap.get(before.id);
      if (!after) return null;
      if (normalizeValue(before.value) !== normalizeValue(after.value)) {
        return { id: before.id, before, after };
      }
      return null;
    })
    .filter(
      (
        x
      ): x is {
        id: string;
        before: typeof schema.memoryNode.$inferSelect;
        after: typeof schema.memoryNode.$inferSelect;
      } => Boolean(x)
    );

  const addedEdges = rightEdges.filter((e) => !leftEdgeMap.has(e.id));
  const removedEdges = leftEdges.filter((e) => !rightEdgeMap.has(e.id));

  return { addedNodes, removedNodes, changedNodes, addedEdges, removedEdges };
}

export async function restoreMemoryCheckpoint(
  ctx: TenantContext,
  checkpointId: string,
  createdBy?: string
): Promise<typeof schema.memoryCheckpoint.$inferSelect> {
  const checkpoint = await getMemoryCheckpointById(ctx, checkpointId);
  if (!checkpoint) {
    throw new Error('Checkpoint not found');
  }

  const now = new Date();
  const nodeSnapshotIds = (checkpoint.nodeSnapshot as string[]) ?? [];
  const edgeSnapshotIds = (checkpoint.edgeSnapshot as string[]) ?? [];

  const [snapshotNodes, snapshotEdges] = await Promise.all([
    getMemoryNodesByIds(ctx, nodeSnapshotIds),
    getMemoryEdgesByIds(ctx, edgeSnapshotIds),
  ]);

  await ctx.tenantScopedDb
    .update(schema.memoryNode)
    .set({ validTo: now })
    .where(and(eq(schema.memoryNode.tenantId, ctx.tenantId), isNull(schema.memoryNode.validTo)));
  await ctx.tenantScopedDb
    .update(schema.memoryEdge)
    .set({ validTo: now })
    .where(and(eq(schema.memoryEdge.tenantId, ctx.tenantId), isNull(schema.memoryEdge.validTo)));

  const oldToNewNodeId = new Map<string, string>();
  for (const node of snapshotNodes) {
    const [created] = await ctx.tenantScopedDb
      .insert(schema.memoryNode)
      .values({
        tenantId: ctx.tenantId,
        kind: node.kind,
        key: node.key,
        value: node.value,
        validFrom: now,
        createdBy,
        sourceId: node.sourceId,
      })
      .returning({ id: schema.memoryNode.id });
    oldToNewNodeId.set(node.id, created.id);
  }

  for (const edge of snapshotEdges) {
    const sourceId = oldToNewNodeId.get(edge.sourceId) ?? edge.sourceId;
    const targetId = oldToNewNodeId.get(edge.targetId) ?? edge.targetId;
    await ctx.tenantScopedDb.insert(schema.memoryEdge).values({
      tenantId: ctx.tenantId,
      sourceId,
      targetId,
      rel: edge.rel,
      weight: edge.weight,
      validFrom: now,
    });
  }

  const [restoreCheckpoint] = await ctx.tenantScopedDb
    .insert(schema.memoryCheckpoint)
    .values({
      tenantId: ctx.tenantId,
      label: `Restore: ${checkpoint.label}`,
      createdBy,
      parentId: checkpoint.id,
      nodeSnapshot: nodeSnapshotIds,
      edgeSnapshot: edgeSnapshotIds,
    })
    .returning();
  return restoreCheckpoint;
}

export async function branchMemoryCheckpoint(
  ctx: TenantContext,
  input: { fromCheckpointId: string; label: string; createdBy?: string }
): Promise<typeof schema.memoryCheckpoint.$inferSelect> {
  const parent = await getMemoryCheckpointById(ctx, input.fromCheckpointId);
  if (!parent) {
    throw new Error('Checkpoint not found');
  }
  return createMemoryCheckpoint(ctx, {
    label: input.label,
    createdBy: input.createdBy,
    parentId: parent.id,
  });
}
