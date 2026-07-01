'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { Workflow } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

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
      config?: Record<string, unknown>;
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
  config?: Record<string, unknown>;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 60;
const KINDS = ['trigger', 'action', 'condition', 'transform', 'approval_gate', 'custom_code'];

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function layout(nodes: Node[], _edges: Edge[]) {
  const cols = 3;
  return nodes.map((n, i) => ({
    ...n,
    x: n.x || 40 + (i % cols) * 180,
    y: n.y || 40 + Math.floor(i / cols) * 120,
  }));
}

function buildNodes(item: WorkflowItem): Node[] {
  const raw = item.workflowJson?.nodes ?? [];
  const nodes = raw.map((n) => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    x: n.position?.x ?? 0,
    y: n.position?.y ?? 0,
    config: n.config,
  }));
  return layout(nodes, buildEdges(item));
}

function buildEdges(item: WorkflowItem): Edge[] {
  return (item.workflowJson?.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    condition: e.condition,
  }));
}

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function WorkflowEditorPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selected, setSelected] = useState<WorkflowItem | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'select' | 'connect'>('select');
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(
    null
  );
  const svgRef = useRef<SVGSVGElement>(null);

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset graph state only when the selected workflow changes
  useEffect(() => {
    if (selected) {
      setNodes(buildNodes(selected));
      setEdges(buildEdges(selected));
    } else {
      setNodes([]);
      setEdges([]);
    }
    setSelectedId(null);
    setPendingSource(null);
    setMode('select');
  }, [selected?.id]);

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  const width = useMemo(
    () => Math.max(600, nodes.length ? Math.max(...nodes.map((n) => n.x)) + 240 : 600),
    [nodes]
  );
  const height = useMemo(
    () => Math.max(400, nodes.length ? Math.max(...nodes.map((n) => n.y)) + 160 : 400),
    [nodes]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );
  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedId) ?? null,
    [edges, selectedId]
  );

  function handleSelectWorkflow(id: string) {
    const workflow = workflows.find((w) => w.id === id) ?? null;
    setSelected(workflow);
  }

  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragging || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragging.offsetX;
    const y = e.clientY - rect.top - dragging.offsetY;
    setNodes((prev) => prev.map((n) => (n.id === dragging.id ? { ...n, x, y } : n)));
  }

  function handleSvgMouseUp() {
    setDragging(null);
  }

  function handleNodeMouseDown(e: React.MouseEvent, nodeId: string) {
    e.stopPropagation();
    if (mode === 'connect') {
      if (!pendingSource) {
        setPendingSource(nodeId);
        setSelectedId(nodeId);
      } else if (pendingSource !== nodeId) {
        addEdge(pendingSource, nodeId);
        setPendingSource(null);
        setMode('select');
        setSelectedId(null);
      }
      return;
    }
    const node = nodeById[nodeId];
    if (!node || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setDragging({
      id: nodeId,
      offsetX: e.clientX - rect.left - node.x,
      offsetY: e.clientY - rect.top - node.y,
    });
    setSelectedId(nodeId);
  }

  function handleSvgClick() {
    setSelectedId(null);
    setPendingSource(null);
  }

  function addNode(kind: string) {
    const count = nodes.filter((n) => n.kind === kind).length;
    const x = 60 + (nodes.length % 4) * 180;
    const y = 60 + Math.floor(nodes.length / 4) * 120;
    const node: Node = {
      id: makeId(kind),
      kind,
      label: `${kind} ${count + 1}`,
      x,
      y,
    };
    setNodes((prev) => [...prev, node]);
    setSelectedId(node.id);
  }

  function addEdge(source: string, target: string) {
    const exists = edges.some((e) => e.source === source && e.target === target);
    if (exists) return;
    const edge: Edge = { id: makeId('edge'), source, target };
    setEdges((prev) => [...prev, edge]);
    setSelectedId(edge.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    if (nodeById[selectedId]) {
      setNodes((prev) => prev.filter((n) => n.id !== selectedId));
      setEdges((prev) => prev.filter((e) => e.source !== selectedId && e.target !== selectedId));
    } else {
      setEdges((prev) => prev.filter((e) => e.id !== selectedId));
    }
    setSelectedId(null);
    setPendingSource(null);
  }

  function updateNode(id: string, patch: Partial<Node>) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function updateEdge(id: string, patch: Partial<Edge>) {
    setEdges((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaveError(null);
    try {
      const workflowJson = {
        nodes: nodes.map((n) => ({
          id: n.id,
          kind: n.kind,
          label: n.label,
          position: { x: n.x, y: n.y },
          config: n.config,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          condition: e.condition,
        })),
      };
      await fetchJson<{ data: WorkflowItem }>(`/api/v1/workflows/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowJson }),
      });
      setSelected((prev) => (prev ? { ...prev, workflowJson } : prev));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow visual editor"
        description="Build and edit workflows visually. Drag nodes, connect them, and save."
      />

      {(error || saveError) && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {error ?? saveError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {workflows.length > 0 && (
          <select
            value={selected?.id ?? ''}
            onChange={(e) => handleSelectWorkflow(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          >
            {workflows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => addNode(kind)}
              className="h-8 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2.5 text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]"
            >
              + {kind}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === 'connect' ? 'select' : 'connect'));
            setPendingSource(null);
          }}
          className={`h-8 rounded-lg px-3 text-[10px] font-medium transition-colors ${
            mode === 'connect'
              ? 'bg-[var(--accent-primary)] text-white'
              : 'border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
          }`}
        >
          {mode === 'connect' ? 'Connecting…' : 'Connect'}
        </button>

        <button
          type="button"
          onClick={deleteSelected}
          disabled={!selectedId}
          className="h-8 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)] disabled:opacity-50"
        >
          Delete
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !selected}
          className="h-8 rounded-lg bg-[var(--accent-primary)] px-4 text-[10px] font-medium text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {loading && <p className="text-xs text-[var(--text-muted)]">Loading…</p>}

      <div className="flex gap-4">
        {selected && (
          <div className="flex-1 overflow-auto rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Workflow className="h-3.5 w-3.5" />
              {nodes.length} nodes · {edges.length} edges
              {mode === 'connect' && pendingSource && (
                <span className="text-[var(--accent-primary)]"> · Select a target node</span>
              )}
            </div>
            <svg
              ref={svgRef}
              width={width}
              height={height}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseUp}
              onClick={handleSvgClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSvgClick();
                }
              }}
              role="button"
              tabIndex={0}
              className="cursor-crosshair rounded-lg bg-[var(--bg-surface-raised)]"
              aria-label="Workflow graph"
            >
              <title>Workflow graph</title>
              {edges.map((edge) => {
                const src = nodeById[edge.source];
                const tgt = nodeById[edge.target];
                if (!src || !tgt) return null;
                const isSelected = edge.id === selectedId;
                return (
                  <g
                    key={edge.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select edge ${edge.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(edge.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedId(edge.id);
                      }
                    }}
                  >
                    <line
                      x1={src.x + NODE_WIDTH / 2}
                      y1={src.y + NODE_HEIGHT}
                      x2={tgt.x + NODE_WIDTH / 2}
                      y2={tgt.y}
                      stroke={isSelected ? 'var(--accent-primary)' : 'var(--border-subtle-solid)'}
                      strokeWidth={isSelected ? 3 : 2}
                      markerEnd="url(#arrow)"
                      className="cursor-pointer"
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
              {nodes.map((node) => {
                const isSelected = node.id === selectedId || node.id === pendingSource;
                return (
                  <g
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.label} (${node.kind})`}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(node.id);
                      }
                    }}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <rect
                      x={node.x}
                      y={node.y}
                      width={NODE_WIDTH}
                      height={NODE_HEIGHT}
                      rx={8}
                      fill={isSelected ? 'var(--bg-surface-raised)' : 'var(--bg-surface)'}
                      stroke={isSelected ? 'var(--accent-primary)' : 'var(--border-subtle-solid)'}
                      strokeWidth={isSelected ? 2 : 1}
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
                );
              })}
            </svg>
          </div>
        )}

        {selectedNode && (
          <div className="w-64 shrink-0 space-y-3 rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">Node</h3>
            <div className="space-y-1">
              <label htmlFor="node-label" className="text-[10px] text-[var(--text-secondary)]">
                Label
              </label>
              <input
                id="node-label"
                type="text"
                value={selectedNode.label}
                onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                className="h-8 w-full rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface-raised)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="node-kind" className="text-[10px] text-[var(--text-secondary)]">
                Kind
              </label>
              <select
                id="node-kind"
                value={selectedNode.kind}
                onChange={(e) => updateNode(selectedNode.id, { kind: e.target.value })}
                className="h-8 w-full rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface-raised)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selectedEdge && (
          <div className="w-64 shrink-0 space-y-3 rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">Edge</h3>
            <div className="space-y-1">
              <label htmlFor="edge-condition" className="text-[10px] text-[var(--text-secondary)]">
                Condition
              </label>
              <input
                id="edge-condition"
                type="text"
                value={selectedEdge.condition ?? ''}
                onChange={(e) => updateEdge(selectedEdge.id, { condition: e.target.value })}
                className="h-8 w-full rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface-raised)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>
          </div>
        )}
      </div>

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
