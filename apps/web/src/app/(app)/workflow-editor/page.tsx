'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { Workflow } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  workflowJson?: {
    nodes?: Array<{
      id: string;
      kind: string;
      label: string;
      position?: { x: number; y: number };
    }>;
    edges?: Array<{ id: string; source: string; target: string; condition?: string }>;
  };
}

interface Node {
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 60;

function layout(nodes: Node[], edges: Edge[]) {
  const cols = 3;
  return nodes.map((n, i) => ({
    ...n,
    x: n.x || 40 + (i % cols) * 180,
    y: n.y || 40 + Math.floor(i / cols) * 120,
  }));
}

function buildNodes(item: WorkflowItem): Node[] {
  const raw = item.workflowJson?.nodes ?? [];
  const nodes = raw.map((n, i) => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    x: n.position?.x ?? 0,
    y: n.position?.y ?? 0,
  }));
  const edges = buildEdges(item);
  return layout(nodes, edges);
}

function buildEdges(item: WorkflowItem): Edge[] {
  return (item.workflowJson?.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    condition: e.condition,
  }));
}

export default function WorkflowEditorPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selected, setSelected] = useState<WorkflowItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchJson<{ data: WorkflowItem[] }>('/api/v1/workflows')
      .then((res) => {
        setWorkflows(res.data);
        if (res.data[0]) setSelected(res.data[0]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const nodes = useMemo(() => (selected ? buildNodes(selected) : []), [selected]);
  const edges = useMemo(() => (selected ? buildEdges(selected) : []), [selected]);
  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const width = useMemo(
    () => Math.max(600, nodes.length ? Math.max(...nodes.map((n) => n.x)) + 200 : 600),
    [nodes]
  );
  const height = useMemo(
    () => Math.max(400, nodes.length ? Math.max(...nodes.map((n) => n.y)) + 120 : 400),
    [nodes]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow visual editor"
        description="Inspect generated and imported workflows as a visual graph."
      />

      {error && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {error}
        </div>
      )}

      {workflows.length > 0 && (
        <select
          value={selected?.id ?? ''}
          onChange={(e) => setSelected(workflows.find((w) => w.id === e.target.value) ?? null)}
          className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        >
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}

      {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}

      {selected && (
        <div className="overflow-auto rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Workflow className="h-3.5 w-3.5" />
            {nodes.length} nodes · {edges.length} edges
          </div>
          <svg
            width={width}
            height={height}
            className="rounded-lg bg-[var(--bg-surface-raised)]"
            aria-label="Workflow graph"
          >
            <title>Workflow graph</title>
            {edges.map((edge) => {
              const src = nodeById[edge.source];
              const tgt = nodeById[edge.target];
              if (!src || !tgt) return null;
              return (
                <g key={edge.id}>
                  <line
                    x1={src.x + NODE_WIDTH / 2}
                    y1={src.y + NODE_HEIGHT}
                    x2={tgt.x + NODE_WIDTH / 2}
                    y2={tgt.y}
                    stroke="var(--border-subtle-solid)"
                    strokeWidth={2}
                    markerEnd="url(#arrow)"
                  />
                  {edge.condition && (
                    <text
                      x={(src.x + tgt.x) / 2 + NODE_WIDTH / 2}
                      y={(src.y + tgt.y) / 2 + NODE_HEIGHT / 2}
                      fill="var(--text-muted)"
                      fontSize={10}
                    >
                      {edge.condition}
                    </text>
                  )}
                </g>
              );
            })}
            <defs>
              <marker
                id="arrow"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L0,6 L9,3 z" fill="var(--border-subtle-solid)" />
              </marker>
            </defs>
            {nodes.map((node) => (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={8}
                  fill="var(--bg-surface)"
                  stroke="var(--border-subtle-solid)"
                />
                <text
                  x={node.x + NODE_WIDTH / 2}
                  y={node.y + NODE_HEIGHT / 2 - 4}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize={11}
                  fontWeight={600}
                >
                  {node.label}
                </text>
                <text
                  x={node.x + NODE_WIDTH / 2}
                  y={node.y + NODE_HEIGHT / 2 + 12}
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize={9}
                >
                  {node.kind}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {!loading && workflows.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle-solid)] p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            No workflows yet. Generate or import one first.
          </p>
        </div>
      )}
    </div>
  );
}
