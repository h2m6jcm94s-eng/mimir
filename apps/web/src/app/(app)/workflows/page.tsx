'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import type { Node } from '@mimir/shared-types';
import { Play, Plus, Server, Wand2, Workflow } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface WorkflowNode {
  id: string;
  kind: string;
  label: string;
  config: Record<string, unknown>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  cron: string;
  enabled: boolean;
  sourceFormat: string;
  nodeId?: string;
  workflowJson?: { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  optimizationLog?: unknown[];
  lastRunStatus?: string;
}

interface WorkflowRun {
  id: string;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selected, setSelected] = useState<WorkflowItem | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importJson, setImportJson] = useState('');
  const [generateText, setGenerateText] = useState('');
  const [assigningNode, setAssigningNode] = useState(false);

  const loadWorkflows = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchJson<{ data: WorkflowItem[] }>('/api/v1/workflows')
      .then((res) => setWorkflows(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const loadNodes = useCallback(() => {
    fetchJson<{ data: Node[] }>('/api/v1/nodes')
      .then((res) => setNodes(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    loadNodes();
  }, [loadNodes]);

  useEffect(() => {
    if (selected) {
      fetchJson<{ data: WorkflowRun[] }>(`/api/v1/workflows/${selected.id}/runs`)
        .then((res) => setRuns(res.data))
        .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    }
  }, [selected]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!generateText.trim()) return;
    await fetchJson<{ data: WorkflowItem }>('/api/v1/workflows/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: generateText, tier: 0 }),
    });
    setGenerateText('');
    loadWorkflows();
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importJson.trim()) return;
    const n8nWorkflowJson = JSON.parse(importJson);
    await fetchJson<{ data: WorkflowItem }>('/api/v1/workflows/import/n8n', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: n8nWorkflowJson.name ?? 'Imported workflow',
        description: '',
        n8nWorkflowJson,
      }),
    });
    setImportJson('');
    loadWorkflows();
  }

  async function handleRun(id: string) {
    await fetchJson<{ data: WorkflowRun }>(`/api/v1/workflows/${id}/run`, { method: 'POST' });
    if (selected?.id === id) {
      const res = await fetchJson<{ data: WorkflowRun[] }>(`/api/v1/workflows/${id}/runs`);
      setRuns(res.data);
    }
    loadWorkflows();
  }

  async function handleOptimize(id: string) {
    await fetchJson<{ data: { graph: { nodes: WorkflowNode[] } } }>(
      `/api/v1/workflows/${id}/optimize`,
      {
        method: 'POST',
      }
    );
    loadWorkflows();
  }

  async function assignNode(workflowId: string, nodeId: string) {
    setAssigningNode(true);
    try {
      const body = await fetchJson<{ data: WorkflowItem }>(`/api/v1/workflows/${workflowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: nodeId || null }),
      });
      setSelected(body.data);
      await loadWorkflows();
    } finally {
      setAssigningNode(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Workflows" />

      {error && (
        <div className="rounded-md bg-red-100 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <form onSubmit={handleGenerate} className="space-y-3 rounded-lg border p-4">
            <h3 className="font-medium">Generate workflow</h3>
            <input
              value={generateText}
              onChange={(e) => setGenerateText(e.target.value)}
              placeholder="Describe what you want to automate..."
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white"
            >
              <Wand2 className="h-4 w-4" /> Generate
            </button>
          </form>

          <form onSubmit={handleImport} className="space-y-3 rounded-lg border p-4">
            <h3 className="font-medium">Import n8n workflow</h3>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder="Paste exported n8n JSON here"
              rows={6}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono"
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Import
            </button>
          </form>

          <div className="space-y-2">
            <h3 className="font-medium">Workflows</h3>
            {loading && <p className="text-sm text-[var(--text-muted)]">Loading…</p>}
            {workflows.map((wf) => (
              <button
                key={wf.id}
                type="button"
                onClick={() => setSelected(wf)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md border p-3 text-left text-sm',
                  selected?.id === wf.id &&
                    'border-[var(--accent-primary)] bg-[var(--bg-surface-raised)]'
                )}
              >
                <Workflow className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{wf.name}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    wf.enabled
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                  )}
                >
                  {wf.enabled ? 'Enabled' : 'Draft'}
                </span>
              </button>
            ))}
            {!loading && workflows.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">No workflows yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {selected ? (
            <>
              <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.name}</h2>
                    {selected.description && (
                      <p className="text-sm text-[var(--text-muted)]">{selected.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOptimize(selected.id)}
                      className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium"
                    >
                      <Wand2 className="h-4 w-4" /> Optimize
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRun(selected.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white"
                    >
                      <Play className="h-4 w-4" /> Run
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="text-sm">
                    <span className="text-[var(--text-muted)]">Source:</span>{' '}
                    {selected.sourceFormat}
                  </div>
                  <div className="text-sm">
                    <span className="text-[var(--text-muted)]">Cron:</span>{' '}
                    {selected.cron || 'manual'}
                  </div>
                  <div className="text-sm">
                    <span className="text-[var(--text-muted)]">Status:</span>{' '}
                    {selected.lastRunStatus ?? 'never run'}
                  </div>
                  <div className="text-sm">
                    <span className="text-[var(--text-muted)]">Assigned node:</span>{' '}
                    {selected.nodeId ? (
                      <span className="inline-flex items-center gap-1">
                        <Server className="h-3.5 w-3.5" />
                        {nodes.find((n) => n.id === selected.nodeId)?.name ?? selected.nodeId}
                      </span>
                    ) : (
                      'Any node'
                    )}
                  </div>
                  <div className="text-sm">
                    <span className="text-[var(--text-muted)]">Nodes:</span>{' '}
                    {selected.workflowJson?.nodes.length ?? 0}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <select
                    value={selected.nodeId ?? ''}
                    onChange={(e) => assignNode(selected.id, e.target.value)}
                    disabled={assigningNode}
                    className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] disabled:opacity-50"
                  >
                    <option value="">Any node</option>
                    {nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name} ({node.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selected.workflowJson && (
                <div className="rounded-lg border p-4">
                  <h3 className="mb-3 font-medium">Nodes</h3>
                  <div className="space-y-2">
                    {selected.workflowJson.nodes.map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between rounded-md bg-[var(--bg-surface-raised)] p-3 text-sm"
                      >
                        <div>
                          <span className="font-medium">{node.label}</span>
                          <span className="ml-2 rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                            {node.kind}
                          </span>
                        </div>
                        {node.config &&
                        typeof node.config === 'object' &&
                        'action' in node.config &&
                        node.config.action ? (
                          <span className="text-xs text-[var(--text-muted)]">
                            {String(node.config.action)}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {selected.workflowJson.edges.length > 0 && (
                    <>
                      <h3 className="mb-3 mt-6 font-medium">Edges</h3>
                      <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                        {selected.workflowJson.edges.map((edge) => (
                          <li key={edge.id}>
                            {edge.source} → {edge.target}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              {nodes.length > 0 && (
                <div className="rounded-lg border p-4">
                  <h3 className="mb-3 font-medium">Node assignments</h3>
                  <div className="space-y-2">
                    {nodes.map((node) => {
                      const assigned = workflows.filter((wf) => wf.nodeId === node.id);
                      return (
                        <div
                          key={node.id}
                          className="flex items-center justify-between rounded-md bg-[var(--bg-surface-raised)] p-3 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-[var(--text-muted)]" />
                            <span className="font-medium">{node.name}</span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                                node.status === 'up'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                              )}
                            >
                              {node.status}
                            </span>
                          </div>
                          <span className="text-xs text-[var(--text-muted)]">
                            {assigned.length} workflow{assigned.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {runs.length > 0 && (
                <div className="rounded-lg border p-4">
                  <h3 className="mb-3 font-medium">Recent runs</h3>
                  <div className="space-y-2">
                    {runs.map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center justify-between rounded-md bg-[var(--bg-surface-raised)] p-3 text-sm"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={cn(
                              'w-fit rounded-full px-2 py-0.5 text-xs',
                              run.status === 'done'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                                : run.status === 'failed'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                            )}
                          >
                            {run.status}
                          </span>
                          {(run.errorCode || typeof run.metadata?.targetNodeId === 'string') && (
                            <span className="text-xs text-[var(--text-muted)]">
                              {run.errorCode ?? ''}
                              {run.errorCode && typeof run.metadata?.targetNodeId === 'string'
                                ? ' · '
                                : ''}
                              {typeof run.metadata?.targetNodeId === 'string'
                                ? (nodes.find((n) => n.id === run.metadata?.targetNodeId)?.name ??
                                  run.metadata.targetNodeId)
                                : ''}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatDate(run.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border text-sm text-[var(--text-muted)]">
              Select a workflow to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
