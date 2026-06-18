'use client';

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge as ReactFlowEdge,
  type Node as ReactFlowNode,
} from '@xyflow/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import '@xyflow/react/dist/style.css';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import type { MemoryCheckpoint, MemoryEdge, MemoryNode } from '@mimir/shared-types';
import {
  ArrowLeftRight,
  BrainCircuit,
  Clock,
  GitBranch,
  History,
  Loader2,
  RotateCcw,
} from 'lucide-react';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options?.headers ?? {}),
      ...(options?.body && { 'content-type': 'application/json' }),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString();
}

function nodeColor(kind: MemoryNode['kind']) {
  switch (kind) {
    case 'semantic':
      return '#4338CA';
    case 'episodic':
      return '#0D9488';
    case 'procedural':
      return '#D97706';
    default:
      return '#64748B';
  }
}

function layoutNodes(nodes: MemoryNode[]): ReactFlowNode[] {
  const centerX = 250;
  const centerY = 200;
  const radius = 180;
  return nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / Math.max(nodes.length, 1) - Math.PI / 2;
    return {
      id: node.id,
      position: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
      data: { label: node.key },
      style: { background: nodeColor(node.kind), color: '#fff' },
    };
  });
}

function layoutEdges(edges: MemoryEdge[]): ReactFlowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    label: edge.rel,
  }));
}

interface DiffData {
  addedNodes: MemoryNode[];
  removedNodes: MemoryNode[];
  changedNodes: { id: string; before: MemoryNode; after: MemoryNode }[];
  addedEdges: MemoryEdge[];
  removedEdges: MemoryEdge[];
}

export default function MemoryPage() {
  const [tab, setTab] = useState<'time' | 'graph'>('time');
  const [checkpoints, setCheckpoints] = useState<MemoryCheckpoint[]>([]);
  const [nodes, setNodes] = useState<MemoryNode[]>([]);
  const [edges, setEdges] = useState<MemoryEdge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<string | null>(null);
  const [diff, setDiff] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const reload = useCallback(async () => {
    const [{ data: checkpointData }, { data: graphData }] = await Promise.all([
      fetchJson<{ data: MemoryCheckpoint[] }>('/api/v1/memory/checkpoints'),
      fetchJson<{ data: { nodes: MemoryNode[]; edges: MemoryEdge[] } }>('/api/v1/memory/graph'),
    ]);
    setCheckpoints(checkpointData);
    if (checkpointData.length > 0) {
      setSelected((prev) => prev ?? checkpointData[0].id);
    }
    setNodes(graphData.nodes);
    setEdges(graphData.edges);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    reload()
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (!selected) {
      setDiff(null);
      return;
    }
    let cancelled = false;
    const compareId = compare ?? '';
    fetchJson<{ data: DiffData }>(
      `/api/v1/memory/checkpoints/${selected}/diff${compareId ? `?compare=${compareId}` : ''}`
    )
      .then(({ data }) => {
        if (!cancelled) setDiff(data);
      })
      .catch(() => {
        if (!cancelled) setDiff(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, compare]);

  const current = useMemo(
    () => checkpoints.find((c) => c.id === selected),
    [checkpoints, selected]
  );
  const previous = useMemo(
    () => checkpoints.find((c) => c.id === compare) ?? undefined,
    [checkpoints, compare]
  );

  const handleRestore = async () => {
    if (!selected) return;
    setActionPending(true);
    try {
      await fetchJson(`/api/v1/memory/checkpoints/${selected}/restore`, { method: 'POST' });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionPending(false);
    }
  };

  const handleBranch = async () => {
    if (!selected) return;
    const label = window.prompt('Branch label');
    if (!label) return;
    setActionPending(true);
    try {
      await fetchJson('/api/v1/memory/branch', {
        method: 'POST',
        body: JSON.stringify({ fromCheckpointId: selected, label }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionPending(false);
    }
  };

  const handleCreateCheckpoint = async () => {
    const label = window.prompt('Checkpoint label');
    if (!label) return;
    setActionPending(true);
    try {
      await fetchJson('/api/v1/memory/checkpoints', {
        method: 'POST',
        body: JSON.stringify({ label }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionPending(false);
    }
  };

  const flowNodes = useMemo(() => layoutNodes(nodes), [nodes]);
  const flowEdges = useMemo(() => layoutEdges(edges), [edges]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memory"
        description="Time-machine checkpoints and interactive knowledge graph."
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('time')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'time'
              ? 'bg-[var(--accent-primary)] text-white'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
          )}
        >
          <History className="h-3.5 w-3.5" /> Time Machine
        </button>
        <button
          type="button"
          onClick={() => setTab('graph')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            tab === 'graph'
              ? 'bg-[var(--accent-primary)] text-white'
              : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
          )}
        >
          <BrainCircuit className="h-3.5 w-3.5" /> Graph Memory
        </button>
        <button
          type="button"
          onClick={handleCreateCheckpoint}
          disabled={actionPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-surface-raised)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--border-subtle-solid)] disabled:opacity-50"
        >
          {actionPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
          Save checkpoint
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[var(--text-muted)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading memory…
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {tab === 'time' ? (
            <motion.div
              key="time"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="grid gap-4 lg:grid-cols-3"
            >
              <div className="space-y-4 lg:col-span-1">
                <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card">
                  <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
                    Checkpoints
                  </h3>
                  {checkpoints.length === 0 ? (
                    <p className="text-sm text-[var(--text-muted)]">No checkpoints yet.</p>
                  ) : (
                    <div className="relative space-y-0">
                      {checkpoints.map((cp, index) => {
                        const active = cp.id === selected;
                        return (
                          <motion.button
                            key={cp.id}
                            type="button"
                            onClick={() => setSelected(cp.id)}
                            onMouseEnter={() => setCompare(cp.id === selected ? null : cp.id)}
                            onMouseLeave={() => setCompare(null)}
                            whileHover={{ x: 4 }}
                            className="relative flex w-full items-start gap-3 py-3 text-left"
                          >
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  'flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors',
                                  active
                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]'
                                    : 'border-[var(--border-subtle-solid)] bg-[var(--bg-primary)]'
                                )}
                              >
                                {active && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </div>
                              {index < checkpoints.length - 1 && (
                                <div className="mt-1 h-full w-px bg-[var(--border-subtle-solid)]" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p
                                className={cn(
                                  'text-sm font-medium',
                                  active
                                    ? 'text-[var(--accent-primary)]'
                                    : 'text-[var(--text-primary)]'
                                )}
                              >
                                {cp.label}
                              </p>
                              <p className="text-xs text-[var(--text-muted)]">
                                {formatDate(cp.createdAt)} · {cp.nodeCount} nodes / {cp.edgeCount}{' '}
                                edges
                              </p>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(checkpoints[0]?.id ?? null)}
                    disabled={actionPending || checkpoints.length === 0}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-warning)]/10 px-3 py-2 text-xs font-medium text-[var(--accent-warning)] transition-colors hover:bg-[var(--accent-warning)]/20 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Rewind
                  </button>
                  <button
                    type="button"
                    onClick={handleRestore}
                    disabled={actionPending || !selected}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-primary)]/10 px-3 py-2 text-xs font-medium text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/20 disabled:opacity-50"
                  >
                    <Clock className="h-3.5 w-3.5" /> Restore
                  </button>
                  <button
                    type="button"
                    onClick={handleBranch}
                    disabled={actionPending || !selected}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--bg-surface-raised)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--border-subtle-solid)] disabled:opacity-50"
                  >
                    <GitBranch className="h-3.5 w-3.5" /> Branch
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--bg-surface)] p-4 shadow-card lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Diff view</h3>
                  {compare && previous && current && (
                    <span className="text-xs text-[var(--text-muted)]">
                      {previous.label} → {current.label}
                    </span>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <Clock className="h-3.5 w-3.5" />
                      {previous ? previous.label : 'No comparison'}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {previous
                        ? `${previous.nodeCount} nodes, ${previous.edgeCount} edges.`
                        : 'Hover a checkpoint to compare.'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5 p-4">
                    <div className="mb-2 flex items-center gap-2 text-xs text-[var(--accent-primary)]">
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      {current ? current.label : 'Select a checkpoint'}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {current
                        ? `${current.nodeCount} nodes, ${current.edgeCount} edges.`
                        : 'No checkpoint selected.'}
                    </p>
                  </div>
                </div>
                {diff && (
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-4">
                    <div className="rounded bg-green-100 p-2 dark:bg-green-900">
                      +{diff.addedNodes.length} nodes
                    </div>
                    <div className="rounded bg-red-100 p-2 dark:bg-red-900">
                      -{diff.removedNodes.length} nodes
                    </div>
                    <div className="rounded bg-blue-100 p-2 dark:bg-blue-900">
                      ~{diff.changedNodes.length} changed
                    </div>
                    <div className="rounded bg-purple-100 p-2 dark:bg-purple-900">
                      ±{diff.addedEdges.length + diff.removedEdges.length} edges
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="graph"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="h-[60vh] rounded-xl bg-[var(--bg-surface)] p-2 shadow-card"
            >
              {nodes.length === 0 ? (
                <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
                  No memory nodes yet.
                </div>
              ) : (
                <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
                  <Background gap={16} />
                  <Controls />
                  <MiniMap className="hidden lg:block" />
                </ReactFlow>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
