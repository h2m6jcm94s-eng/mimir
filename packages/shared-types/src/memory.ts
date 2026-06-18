import { z } from 'zod';

export const MemoryNodeKind = z.enum(['semantic', 'episodic', 'procedural']);
export type MemoryNodeKind = z.infer<typeof MemoryNodeKind>;

export const MemoryNode = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  kind: MemoryNodeKind,
  key: z.string(),
  value: z.record(z.unknown()),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable(),
  createdBy: z.string().uuid().optional(),
  sourceId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
});
export type MemoryNode = z.infer<typeof MemoryNode>;

export const MemoryEdge = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  rel: z.string(),
  weight: z.number().min(0).max(1),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type MemoryEdge = z.infer<typeof MemoryEdge>;

export const MemoryCheckpoint = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  label: z.string(),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  nodeCount: z.number().int().min(0),
  edgeCount: z.number().int().min(0),
});
export type MemoryCheckpoint = z.infer<typeof MemoryCheckpoint>;

export const MemoryGraph = z.object({
  nodes: z.array(MemoryNode),
  edges: z.array(MemoryEdge),
});
export type MemoryGraph = z.infer<typeof MemoryGraph>;

export const CheckpointDiff = z.object({
  addedNodes: z.array(MemoryNode),
  removedNodes: z.array(MemoryNode),
  changedNodes: z.array(
    z.object({
      id: z.string().uuid(),
      before: MemoryNode,
      after: MemoryNode,
    })
  ),
  addedEdges: z.array(MemoryEdge),
  removedEdges: z.array(MemoryEdge),
});
export type CheckpointDiff = z.infer<typeof CheckpointDiff>;

export const CreateMemoryNodeRequest = z.object({
  kind: MemoryNodeKind,
  key: z.string().min(1).max(512),
  value: z.record(z.unknown()).default({}),
  sourceId: z.string().uuid().optional(),
});
export type CreateMemoryNodeRequest = z.infer<typeof CreateMemoryNodeRequest>;

export const UpdateMemoryNodeRequest = z.object({
  value: z.record(z.unknown()),
});
export type UpdateMemoryNodeRequest = z.infer<typeof UpdateMemoryNodeRequest>;

export const CreateMemoryEdgeRequest = z.object({
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  rel: z.string().min(1).max(128).default('relates_to'),
  weight: z.number().min(0).max(1).default(1),
});
export type CreateMemoryEdgeRequest = z.infer<typeof CreateMemoryEdgeRequest>;

export const CreateMemoryCheckpointRequest = z.object({
  label: z.string().min(1).max(255),
});
export type CreateMemoryCheckpointRequest = z.infer<typeof CreateMemoryCheckpointRequest>;

export const BranchMemoryCheckpointRequest = z.object({
  fromCheckpointId: z.string().uuid(),
  label: z.string().min(1).max(255),
});
export type BranchMemoryCheckpointRequest = z.infer<typeof BranchMemoryCheckpointRequest>;

export const MemoryGraphQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  checkpointId: z.string().uuid().optional(),
});
export type MemoryGraphQuery = z.infer<typeof MemoryGraphQuery>;

export const CheckpointDiffQuery = z.object({
  compare: z.string().uuid().optional(),
});
export type CheckpointDiffQuery = z.infer<typeof CheckpointDiffQuery>;

export const CreateRelationshipMemoryRequest = z.object({
  name: z.string().min(1).max(255),
  relationship: z.string().min(1).max(128),
  notes: z.string().max(2000).optional(),
  birthday: z.string().datetime().optional(),
  preferences: z.record(z.string()).default({}),
});
export type CreateRelationshipMemoryRequest = z.infer<typeof CreateRelationshipMemoryRequest>;

export const RelationshipMemory = z.object({
  id: z.string().uuid(),
  name: z.string(),
  relationship: z.string(),
  notes: z.string().nullable(),
  birthday: z.string().datetime().nullable(),
  preferences: z.record(z.string()),
  createdAt: z.string().datetime(),
});
export type RelationshipMemory = z.infer<typeof RelationshipMemory>;

export const ListRelationshipMemoryResponse = z.object({
  data: z.array(RelationshipMemory),
});
export type ListRelationshipMemoryResponse = z.infer<typeof ListRelationshipMemoryResponse>;
