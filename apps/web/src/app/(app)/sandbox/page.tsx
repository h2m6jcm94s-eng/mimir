'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { AlertTriangle, Check, Play, Shield, Terminal } from 'lucide-react';
import { useState } from 'react';

interface AnalysisMessage {
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  ruleId: string;
}

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export default function SandboxPage() {
  const [code, setCode] = useState("console.log('hello sandbox');");
  const [command, setCommand] = useState('node');
  const [args, setArgs] = useState('-e');
  const [activeTab, setActiveTab] = useState<'analyze' | 'run' | 'gate'>('analyze');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{ ok: boolean; messages: AnalysisMessage[] } | null>(
    null
  );
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [gateResult, setGateResult] = useState<unknown | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetchJson<{ ok: boolean; messages: AnalysisMessage[] }>(
        '/api/v1/sandbox/analyze',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        }
      );
      setAnalysis(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRun() {
    setLoading(true);
    setError(null);
    setRunResult(null);
    try {
      const res = await fetchJson<RunResult>('/api/v1/sandbox/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          args: args.split(' ').filter(Boolean),
          timeoutMs: 30000,
        }),
      });
      setRunResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGate() {
    setLoading(true);
    setError(null);
    setGateResult(null);
    try {
      const res = await fetchJson<unknown>('/api/v1/sandbox/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          run: { command, args: args.split(' ').filter(Boolean), timeoutMs: 30000 },
        }),
      });
      setGateResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handlePrimaryAction() {
    if (activeTab === 'analyze') return handleAnalyze();
    if (activeTab === 'run') return handleRun();
    return handleGate();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sandbox playground"
        description="Analyze, run, and gate untrusted code in an isolated sandbox."
      />

      <div className="flex gap-2">
        {(['analyze', 'run', 'gate'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
            }`}
          >
            {tab === 'analyze' && <Shield className="mb-0.5 mr-1 inline h-3.5 w-3.5" />}
            {tab === 'run' && <Play className="mb-0.5 mr-1 inline h-3.5 w-3.5" />}
            {tab === 'gate' && <AlertTriangle className="mb-0.5 mr-1 inline h-3.5 w-3.5" />}
            {tab}
          </button>
        ))}
      </div>

      {activeTab !== 'analyze' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Command"
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          />
          <input
            type="text"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder="Args (space separated)"
            className="h-9 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] sm:col-span-2"
          />
        </div>
      )}

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={12}
        className="w-full rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 font-mono text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        placeholder="Paste code here..."
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handlePrimaryAction}
          disabled={loading || !code}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
        >
          <Terminal className="h-3.5 w-3.5" />
          {loading
            ? 'Running…'
            : activeTab === 'analyze'
              ? 'Run analysis'
              : activeTab === 'run'
                ? 'Run'
                : 'Gate'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--text-danger)]/20 bg-[var(--text-danger)]/10 px-3 py-2 text-xs text-[var(--text-danger)]">
          {error}
        </div>
      )}

      {analysis && (
        <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            {analysis.ok ? (
              <Check className="h-4 w-4 text-[var(--accent-success)]" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-[var(--text-danger)]" />
            )}
            Static analysis {analysis.ok ? 'passed' : 'failed'}
          </h3>
          {analysis.messages.length > 0 && (
            <ul className="space-y-2">
              {analysis.messages.map((m, i) => (
                <li
                  key={`${m.line}-${m.column}-${m.ruleId}-${i}`}
                  className="text-xs text-[var(--text-secondary)]"
                >
                  <span
                    className={`rounded px-1.5 py-0.5 ${m.severity === 'error' ? 'bg-[var(--text-danger)]/10 text-[var(--text-danger)]' : 'bg-[var(--text-warning)]/10 text-[var(--text-warning)]'}`}
                  >
                    {m.severity}
                  </span>{' '}
                  {m.ruleId} — {m.message} (line {m.line})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {runResult && (
        <div className="space-y-3 rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Run result</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Exit code: {runResult.exitCode ?? 'null'}
          </p>
          {runResult.timedOut && <p className="text-xs text-[var(--text-danger)]">Timed out</p>}
          {runResult.stdout && (
            <pre className="max-h-48 overflow-auto rounded-lg bg-[var(--bg-surface-raised)] p-3 text-xs text-[var(--text-secondary)]">
              {runResult.stdout}
            </pre>
          )}
          {runResult.stderr && (
            <pre className="max-h-48 overflow-auto rounded-lg bg-[var(--text-danger)]/10 p-3 text-xs text-[var(--text-danger)]">
              {runResult.stderr}
            </pre>
          )}
        </div>
      )}

      {Boolean(gateResult) && (
        <div className="rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4 shadow-card">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Gate result</h3>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-[var(--bg-surface-raised)] p-3 text-xs text-[var(--text-secondary)]">
            {JSON.stringify(gateResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
