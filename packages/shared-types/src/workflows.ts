import { z } from 'zod';

export const WorkflowNodeKind = z.enum([
  'trigger',
  'action',
  'condition',
  'transform',
  'approval_gate',
  'custom_code',
]);
export type WorkflowNodeKind = z.infer<typeof WorkflowNodeKind>;

export const WorkflowNode = z.object({
  id: z.string().min(1),
  kind: WorkflowNodeKind,
  label: z.string().min(1),
  config: z.record(z.unknown()).default({}),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});
export type WorkflowNode = z.infer<typeof WorkflowNode>;

export const WorkflowEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  condition: z.string().optional(),
});
export type WorkflowEdge = z.infer<typeof WorkflowEdge>;

export const WorkflowGraph = z.object({
  nodes: z.array(WorkflowNode).default([]),
  edges: z.array(WorkflowEdge).default([]),
});
export type WorkflowGraph = z.infer<typeof WorkflowGraph>;

export const ImportN8nWorkflowRequest = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  n8nWorkflowJson: z.record(z.unknown()),
});
export type ImportN8nWorkflowRequest = z.infer<typeof ImportN8nWorkflowRequest>;

export const ImportN8nWorkflowResponse = z.object({
  data: z.object({ id: z.string().uuid(), graph: WorkflowGraph }),
});
export type ImportN8nWorkflowResponse = z.infer<typeof ImportN8nWorkflowResponse>;

export const GenerateWorkflowRequest = z.object({
  description: z.string().min(1),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
});
export type GenerateWorkflowRequest = z.infer<typeof GenerateWorkflowRequest>;

export const GenerateWorkflowResponse = z.object({
  data: z.object({ id: z.string().uuid(), graph: WorkflowGraph }),
});
export type GenerateWorkflowResponse = z.infer<typeof GenerateWorkflowResponse>;

export const OptimizeWorkflowResponse = z.object({
  data: z.object({
    graph: WorkflowGraph,
    log: z.array(z.record(z.unknown())),
  }),
});
export type OptimizeWorkflowResponse = z.infer<typeof OptimizeWorkflowResponse>;
