'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import type { Tool, ToolField } from '@mimir/shared-types';
import { Loader2, Play, Plus, Trash2, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const fieldTypes = ['string', 'number', 'boolean'] as const;

type ToolFormField = ToolField & { key: string };

type ToolForm = {
  name: string;
  description: string;
  action: string;
  fields: ToolFormField[];
};

function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return fetch(url, { credentials: 'include', ...init }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      let message = text;
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        // keep raw text
      }
      throw new Error(message);
    }
    return res.json() as Promise<T>;
  });
}

function statusClasses(status: string) {
  switch (status) {
    case 'active':
      return 'bg-[var(--accent-success)]/10 text-[var(--accent-success)]';
    case 'archived':
      return 'bg-[var(--text-danger)]/10 text-[var(--text-danger)]';
    default:
      return 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)]';
  }
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<ToolForm>({
    name: '',
    description: '',
    action: '',
    fields: [],
  });

  const [runState, setRunState] = useState<{
    toolId: string;
    input: Record<string, unknown>;
    running: boolean;
    result: Record<string, unknown> | null;
    runError: string | null;
  }>({ toolId: '', input: {}, running: false, result: null, runError: null });

  const loadTools = useCallback(async () => {
    const res = await fetchJson<{ data: Tool[] }>('/api/v1/tools');
    setTools(res.data);
  }, []);

  const loadActions = useCallback(async () => {
    const res = await fetchJson<{ data: string[] }>('/api/v1/tools/actions');
    setActions(res.data);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadTools(), loadActions()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadTools, loadActions]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function addField() {
    setForm((f) => ({
      ...f,
      fields: [
        ...f.fields,
        { key: crypto.randomUUID(), name: '', label: '', type: 'string', required: false },
      ],
    }));
  }

  function updateField(index: number, patch: Partial<ToolField>) {
    setForm((f) => ({
      ...f,
      fields: f.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    }));
  }

  function removeField(index: number) {
    setForm((f) => ({
      ...f,
      fields: f.fields.filter((_, i) => i !== index),
    }));
  }

  async function saveTool(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.action) return;
    setSaving(true);
    setError(null);
    try {
      await fetchJson<{ data: Tool }>('/api/v1/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          status: 'active',
        }),
      });
      setForm({ name: '', description: '', action: '', fields: [] });
      await loadTools();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function runTool(tool: Tool) {
    setRunState((s) => ({ ...s, toolId: tool.id, running: true, runError: null, result: null }));
    try {
      const res = await fetchJson<{ data: { result: Record<string, unknown> } }>(
        `/api/v1/tools/${tool.id}/run`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: runState.input }),
        }
      );
      setRunState((s) => ({ ...s, result: res.data.result }));
    } catch (err) {
      setRunState((s) => ({
        ...s,
        runError: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setRunState((s) => ({ ...s, running: false }));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tools" description="Build no-code wrappers around connector actions." />

      {error && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {error}
        </div>
      )}

      {loading && <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={saveTool}
          className="space-y-4 rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">New tool</h3>

          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="tool-name-input"
          />

          <input
            type="text"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="tool-description-input"
          />

          <select
            value={form.action}
            onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
            className="h-9 w-full rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            data-testid="tool-action-select"
          >
            <option value="">Select an action</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Input fields</span>
              <button
                type="button"
                onClick={addField}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-surface-raised)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                data-testid="tool-add-field"
              >
                <Plus className="h-3 w-3" /> Add field
              </button>
            </div>

            {form.fields.map((field, index) => (
              <div key={field.key} className="flex items-center gap-2">
                <input
                  id={`tool-field-name-${field.key}`}
                  type="text"
                  placeholder="Name"
                  value={field.name}
                  onChange={(e) => updateField(index, { name: e.target.value })}
                  className="h-8 flex-1 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid={`tool-field-name-${index}`}
                />
                <input
                  id={`tool-field-label-${field.key}`}
                  type="text"
                  placeholder="Label"
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  className="h-8 flex-1 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid={`tool-field-label-${index}`}
                />
                <select
                  id={`tool-field-type-${field.key}`}
                  value={field.type}
                  onChange={(e) =>
                    updateField(index, { type: e.target.value as (typeof fieldTypes)[number] })
                  }
                  className="h-8 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid={`tool-field-type-${index}`}
                >
                  {fieldTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <label
                  htmlFor={`tool-field-required-${field.key}`}
                  className="flex items-center gap-1 text-xs text-[var(--text-secondary)]"
                >
                  <input
                    id={`tool-field-required-${field.key}`}
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(index, { required: e.target.checked })}
                    data-testid={`tool-field-required-${index}`}
                  />
                  Req
                </label>
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-danger)] hover:bg-[var(--text-danger)]/10"
                  data-testid={`tool-field-remove-${index}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={!form.name || !form.action || saving}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              !form.name || !form.action || saving
                ? 'cursor-not-allowed bg-[var(--bg-primary)] text-[var(--text-muted)]'
                : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
            )}
            data-testid="tool-save"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wrench className="h-3.5 w-3.5" />
            )}
            {saving ? 'Saving…' : 'Create tool'}
          </button>
        </form>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Your tools</h3>
          {tools.length === 0 && !loading && (
            <p className="text-xs text-[var(--text-secondary)]">No tools yet.</p>
          )}
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card"
              data-testid={`tool-card-${tool.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-medium text-[var(--text-primary)]">{tool.name}</h4>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {tool.description || tool.action}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    statusClasses(tool.status)
                  )}
                >
                  {tool.status}
                </span>
              </div>

              {tool.fields.length > 0 && (
                <div className="mt-3 space-y-2">
                  {tool.fields.map((field) => (
                    <div key={field.name} className="flex flex-col gap-1">
                      <label
                        htmlFor={`tool-run-field-${tool.id}-${field.name}`}
                        className="text-xs text-[var(--text-secondary)]"
                      >
                        {field.label || field.name}
                        {field.required && <span className="text-[var(--text-danger)]">*</span>}
                      </label>
                      {field.type === 'boolean' ? (
                        <input
                          id={`tool-run-field-${tool.id}-${field.name}`}
                          type="checkbox"
                          checked={Boolean(runState.input[field.name])}
                          onChange={(e) =>
                            setRunState((s) => ({
                              ...s,
                              input: { ...s.input, [field.name]: e.target.checked },
                            }))
                          }
                          className="h-4 w-4"
                          data-testid={`tool-run-field-${tool.id}-${field.name}`}
                        />
                      ) : (
                        <input
                          id={`tool-run-field-${tool.id}-${field.name}`}
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={String(runState.input[field.name] ?? '')}
                          onChange={(e) =>
                            setRunState((s) => ({
                              ...s,
                              input: {
                                ...s.input,
                                [field.name]:
                                  field.type === 'number' ? Number(e.target.value) : e.target.value,
                              },
                            }))
                          }
                          className="h-8 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                          data-testid={`tool-run-field-${tool.id}-${field.name}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => runTool(tool)}
                disabled={runState.running && runState.toolId === tool.id}
                className={cn(
                  'mt-3 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  runState.running && runState.toolId === tool.id
                    ? 'cursor-not-allowed bg-[var(--bg-primary)] text-[var(--text-muted)]'
                    : 'bg-[var(--bg-surface-raised)] text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
                )}
                data-testid={`tool-run-${tool.id}`}
              >
                {runState.running && runState.toolId === tool.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Run
              </button>

              {runState.toolId === tool.id && runState.runError && (
                <div className="mt-2 rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
                  {runState.runError}
                </div>
              )}

              {runState.toolId === tool.id && runState.result && (
                <pre
                  className="mt-2 max-h-40 overflow-auto rounded-lg bg-[var(--bg-primary)] p-2 text-xs text-[var(--text-secondary)]"
                  data-testid={`tool-result-${tool.id}`}
                >
                  {JSON.stringify(runState.result, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
