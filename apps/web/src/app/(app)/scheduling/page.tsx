'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import type {
  Project,
  Resource,
  ScheduleAssignment,
  SchedulingProjectStatus,
  UtilizationSummary,
} from '@mimir/shared-types';
import { BarChart3, Briefcase, CalendarClock, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Tab = 'projects' | 'resources' | 'schedule' | 'utilization';

const projectStatuses: SchedulingProjectStatus[] = ['active', 'completed', 'on_hold', 'cancelled'];

function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return fetch(url, { credentials: 'include', ...init }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

function statusClasses(status: string) {
  switch (status) {
    case 'active':
      return 'bg-[var(--accent-success)]/10 text-[var(--accent-success)]';
    case 'completed':
      return 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]';
    case 'on_hold':
      return 'bg-[var(--accent-warning)]/10 text-[var(--accent-warning)]';
    case 'cancelled':
      return 'bg-[var(--text-danger)]/10 text-[var(--text-danger)]';
    default:
      return 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)]';
  }
}

function getCurrentWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

export default function SchedulingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([]);
  const [utilization, setUtilization] = useState<UtilizationSummary | null>(null);

  const [projectForm, setProjectForm] = useState({
    name: '',
    client: '',
    deadline: '',
    status: 'active' as SchedulingProjectStatus,
    estimatedHours: '',
  });
  const [resourceForm, setResourceForm] = useState({
    name: '',
    role: '',
    weeklyCapacityHours: '40',
  });
  const [assignmentForm, setAssignmentForm] = useState({
    projectId: '',
    resourceId: '',
    weekStarting: getCurrentWeek(),
    allocatedHours: '0',
  });
  const [utilWeek, setUtilWeek] = useState(getCurrentWeek());

  const loadProjects = useCallback(async () => {
    const res = await fetchJson<{ data: Project[] }>('/api/v1/scheduling/projects');
    setProjects(res.data);
  }, []);

  const loadResources = useCallback(async () => {
    const res = await fetchJson<{ data: Resource[] }>('/api/v1/scheduling/resources');
    setResources(res.data);
  }, []);

  const loadAssignments = useCallback(async () => {
    const res = await fetchJson<{ data: ScheduleAssignment[] }>('/api/v1/scheduling/assignments');
    setAssignments(res.data);
  }, []);

  const loadUtilization = useCallback(async (weekStarting: string) => {
    const res = await fetchJson<{ data: UtilizationSummary }>(
      `/api/v1/scheduling/utilization?weekStarting=${encodeURIComponent(weekStarting)}`
    );
    setUtilization(res.data);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadProjects(), loadResources(), loadAssignments()]);
      await loadUtilization(utilWeek);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [loadProjects, loadResources, loadAssignments, loadUtilization, utilWeek]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  const resourcesById = useMemo(() => {
    const map = new Map<string, Resource>();
    for (const r of resources) map.set(r.id, r);
    return map;
  }, [resources]);

  function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectForm.name) return;
    fetchJson<{ data: Project }>('/api/v1/scheduling/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectForm.name,
        client: projectForm.client,
        status: projectForm.status,
        deadline: projectForm.deadline ? new Date(projectForm.deadline).toISOString() : undefined,
        estimatedHours: projectForm.estimatedHours ? Number(projectForm.estimatedHours) : undefined,
      }),
    })
      .then(() => {
        setProjectForm({
          name: '',
          client: '',
          deadline: '',
          status: 'active',
          estimatedHours: '',
        });
        loadProjects();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function addResource(e: React.FormEvent) {
    e.preventDefault();
    if (!resourceForm.name) return;
    fetchJson<{ data: Resource }>('/api/v1/scheduling/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: resourceForm.name,
        role: resourceForm.role,
        weeklyCapacityHours: Number(resourceForm.weeklyCapacityHours),
      }),
    })
      .then(() => {
        setResourceForm({ name: '', role: '', weeklyCapacityHours: '40' });
        loadResources();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function addAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!assignmentForm.projectId || !assignmentForm.resourceId) return;
    fetchJson<{ data: ScheduleAssignment }>('/api/v1/scheduling/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: assignmentForm.projectId,
        resourceId: assignmentForm.resourceId,
        weekStarting: assignmentForm.weekStarting,
        allocatedHours: Number(assignmentForm.allocatedHours),
      }),
    })
      .then(() => {
        setAssignmentForm((f) => ({ ...f, allocatedHours: '0' }));
        loadAssignments();
        loadUtilization(utilWeek);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function deleteProject(id: string) {
    fetch(`/api/v1/scheduling/projects/${id}`, { method: 'DELETE', credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        loadProjects();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function deleteResource(id: string) {
    fetch(`/api/v1/scheduling/resources/${id}`, { method: 'DELETE', credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        loadResources();
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  function deleteAssignment(id: string) {
    fetch(`/api/v1/scheduling/assignments/${id}`, { method: 'DELETE', credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        loadAssignments();
        loadUtilization(utilWeek);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduling"
        description="Projects, resources, weekly assignments and utilization for your team."
      />

      {error && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {error}
        </div>
      )}

      <div className="flex gap-2 border-b border-[var(--border-subtle-solid)]">
        {(
          [
            { key: 'projects', label: 'Projects', icon: Briefcase },
            { key: 'resources', label: 'Resources', icon: Users },
            { key: 'schedule', label: 'Schedule', icon: CalendarClock },
            { key: 'utilization', label: 'Utilization', icon: BarChart3 },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
              activeTab === tab.key
                ? 'text-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
            data-testid={`scheduling-tab-${tab.key}`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-[var(--accent-primary)]" />
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {activeTab === 'projects' && (
        <section className="space-y-4">
          <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
            <form onSubmit={addProject} className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Add project</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <input
                  type="text"
                  placeholder="Project name"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="scheduling-project-name"
                />
                <input
                  type="text"
                  placeholder="Client"
                  value={projectForm.client}
                  onChange={(e) => setProjectForm((f) => ({ ...f, client: e.target.value }))}
                  className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="scheduling-project-client"
                />
                <select
                  value={projectForm.status}
                  onChange={(e) =>
                    setProjectForm((f) => ({
                      ...f,
                      status: e.target.value as SchedulingProjectStatus,
                    }))
                  }
                  className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="scheduling-project-status"
                >
                  {projectStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={projectForm.deadline}
                  onChange={(e) => setProjectForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="scheduling-project-deadline"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Estimated hours"
                  value={projectForm.estimatedHours}
                  onChange={(e) =>
                    setProjectForm((f) => ({ ...f, estimatedHours: e.target.value }))
                  }
                  className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="scheduling-project-hours"
                />
              </div>
              <button
                type="submit"
                disabled={!projectForm.name}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
                )}
                data-testid="scheduling-add-project"
              >
                <Plus className="h-3.5 w-3.5" /> Add project
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] shadow-card">
            {projects.length === 0 ? (
              <div className="p-6 text-sm text-[var(--text-secondary)]">No projects yet.</div>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle-solid)]">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                    data-testid="scheduling-project-row"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {p.name}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {p.client || 'No client'} · {formatDate(p.deadline)} ·{' '}
                        {p.estimatedHours ?? '—'} h
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                          statusClasses(p.status)
                        )}
                      >
                        {p.status.replace('_', ' ')}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteProject(p.id)}
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-danger)]"
                        aria-label="Delete project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {activeTab === 'resources' && (
        <section className="space-y-4">
          <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
            <form onSubmit={addResource} className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Add resource</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="Name"
                  value={resourceForm.name}
                  onChange={(e) => setResourceForm((f) => ({ ...f, name: e.target.value }))}
                  className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="scheduling-resource-name"
                />
                <input
                  type="text"
                  placeholder="Role"
                  value={resourceForm.role}
                  onChange={(e) => setResourceForm((f) => ({ ...f, role: e.target.value }))}
                  className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="scheduling-resource-role"
                />
                <input
                  type="number"
                  min={0}
                  max={168}
                  placeholder="Weekly capacity (h)"
                  value={resourceForm.weeklyCapacityHours}
                  onChange={(e) =>
                    setResourceForm((f) => ({ ...f, weeklyCapacityHours: e.target.value }))
                  }
                  className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="scheduling-resource-capacity"
                />
              </div>
              <button
                type="submit"
                disabled={!resourceForm.name}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
                )}
                data-testid="scheduling-add-resource"
              >
                <Plus className="h-3.5 w-3.5" /> Add resource
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] shadow-card">
            {resources.length === 0 ? (
              <div className="p-6 text-sm text-[var(--text-secondary)]">No resources yet.</div>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle-solid)]">
                {resources.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                    data-testid="scheduling-resource-row"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{r.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {r.role || 'No role'} · {r.weeklyCapacityHours} h/week
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteResource(r.id)}
                      className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-danger)]"
                      aria-label="Delete resource"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {activeTab === 'schedule' && (
        <section className="space-y-4">
          <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
            <form onSubmit={addAssignment} className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Assign resource</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  value={assignmentForm.projectId}
                  onChange={(e) => setAssignmentForm((f) => ({ ...f, projectId: e.target.value }))}
                  className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="scheduling-assignment-project"
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={assignmentForm.resourceId}
                  onChange={(e) => setAssignmentForm((f) => ({ ...f, resourceId: e.target.value }))}
                  className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="scheduling-assignment-resource"
                >
                  <option value="">Select resource</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={assignmentForm.weekStarting}
                  onChange={(e) =>
                    setAssignmentForm((f) => ({ ...f, weekStarting: e.target.value }))
                  }
                  className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="scheduling-assignment-week"
                />
                <input
                  type="number"
                  min={0}
                  max={168}
                  placeholder="Hours"
                  value={assignmentForm.allocatedHours}
                  onChange={(e) =>
                    setAssignmentForm((f) => ({ ...f, allocatedHours: e.target.value }))
                  }
                  className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  data-testid="scheduling-assignment-hours"
                />
              </div>
              <button
                type="submit"
                disabled={!assignmentForm.projectId || !assignmentForm.resourceId}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90 disabled:opacity-50'
                )}
                data-testid="scheduling-add-assignment"
              >
                <Plus className="h-3.5 w-3.5" /> Add assignment
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] shadow-card">
            {assignments.length === 0 ? (
              <div className="p-6 text-sm text-[var(--text-secondary)]">No assignments yet.</div>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle-solid)]">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                    data-testid="scheduling-assignment-row"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {projectsById.get(a.projectId)?.name ?? 'Unknown project'}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {resourcesById.get(a.resourceId)?.name ?? 'Unknown resource'} ·{' '}
                        {a.weekStarting} · {a.allocatedHours} h
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteAssignment(a.id)}
                      className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-danger)]"
                      aria-label="Delete assignment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {activeTab === 'utilization' && (
        <section className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
            <label
              htmlFor="scheduling-util-week"
              className="text-xs font-medium text-[var(--text-secondary)]"
            >
              Week starting
            </label>
            <input
              id="scheduling-util-week"
              type="date"
              value={utilWeek}
              onChange={(e) => {
                setUtilWeek(e.target.value);
                loadUtilization(e.target.value).catch((err) =>
                  setError(err instanceof Error ? err.message : String(err))
                );
              }}
              className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              data-testid="scheduling-util-week"
            />
          </div>

          {utilization && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
                  <p className="text-xs font-medium text-[var(--text-muted)]">Capacity</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                    {utilization.totalCapacityHours} h
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
                  <p className="text-xs font-medium text-[var(--text-muted)]">Allocated</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                    {utilization.allocatedHours} h
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
                  <p className="text-xs font-medium text-[var(--text-muted)]">Remaining</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                    {utilization.remainingHours} h
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] shadow-card">
                {utilization.byResource.length === 0 ? (
                  <div className="p-6 text-sm text-[var(--text-secondary)]">
                    No resources to report.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[var(--border-subtle-solid)] text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-4 py-2 font-medium">Resource</th>
                        <th className="px-4 py-2 font-medium">Capacity</th>
                        <th className="px-4 py-2 font-medium">Allocated</th>
                        <th className="px-4 py-2 font-medium">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utilization.byResource.map((r) => (
                        <tr
                          key={r.resourceId}
                          className={cn(
                            'border-b border-[var(--border-subtle-solid)] last:border-0',
                            r.allocatedHours > r.capacityHours && 'bg-[var(--text-danger)]/5'
                          )}
                          data-testid="scheduling-util-row"
                        >
                          <td className="px-4 py-2 text-[var(--text-primary)]">{r.name}</td>
                          <td className="px-4 py-2 text-[var(--text-secondary)]">
                            {r.capacityHours} h
                          </td>
                          <td className="px-4 py-2 text-[var(--text-secondary)]">
                            {r.allocatedHours} h
                          </td>
                          <td className="px-4 py-2 text-[var(--text-secondary)]">
                            {r.remainingHours} h
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
