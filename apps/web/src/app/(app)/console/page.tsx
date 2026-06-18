'use client';

import { ApprovalCard } from '@/components/ui/ApprovalCard';
import { ModelBadge } from '@/components/ui/ModelBadge';
import { SourcesChip } from '@/components/ui/SourcesChip';
import { TierBadge } from '@/components/ui/TierBadge';
import { TrustBadge } from '@/components/ui/TrustBadge';
import { cn } from '@/lib/utils';
import type { AgentRole, Job } from '@mimir/shared-types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileImage,
  FileText,
  Mic,
  Paperclip,
  Play,
  RefreshCw,
  Send,
  Settings2,
  Slash,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Role = 'user' | 'assistant' | 'system';

interface AssistantMessage {
  id: number;
  role: 'assistant';
  content: string;
  model: string;
  confidence: number;
  cost: number;
  tier: 0 | 1 | 2;
  sources?: string[];
  needsApproval?: {
    approvalId: string;
    title: string;
    blastRadius: string;
  };
  jobId?: string;
}

interface UserMessage {
  id: number;
  role: 'user';
  content: string;
}

interface SystemMessage {
  id: number;
  role: 'system';
  variant: 'error' | 'offline';
  content: string;
}

type Message = UserMessage | AssistantMessage | SystemMessage;

const steps = [
  'Classify request privacy tier',
  'Route to Claude (T2, cloud node)',
  'Generate blast-radius preview',
  'Request human approval (destructive)',
];

function isAssistant(msg: Message): msg is AssistantMessage {
  return msg.role === 'assistant';
}

function isSystem(msg: Message): msg is SystemMessage {
  return msg.role === 'system';
}

interface PollResult {
  text: string;
  status: string;
  costUsd: number;
  tier: 0 | 1 | 2;
  model: string;
  sources: string[];
}

function extractSources(job: Job): string[] {
  const checkpoint = (job.checkpoint ?? {}) as Record<string, unknown>;
  const result = (checkpoint.build as Record<string, unknown> | undefined)?.result as
    | Record<string, unknown>
    | undefined;
  const artifacts = (result?.artifacts as Record<string, unknown> | undefined) ?? {};
  const sources = artifacts.sources;
  if (Array.isArray(sources)) return sources.filter((s): s is string => typeof s === 'string');
  return [];
}

async function pollJob(jobId: string): Promise<PollResult> {
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/tasks/${jobId}`, {
      credentials: 'include',
    });
    if (!res.ok) continue;
    const job = (await res.json()) as Job;
    if (job.status === 'done' || job.status === 'failed' || job.status === 'needs_attention') {
      const checkpoint = (job.checkpoint ?? {}) as Record<string, unknown>;
      const result = (checkpoint.build as Record<string, unknown> | undefined)?.result as
        | Record<string, unknown>
        | undefined;
      const artifacts = (result?.artifacts as Record<string, unknown> | undefined) ?? {};
      const modelOutput = artifacts.model as Record<string, unknown> | undefined;
      const text =
        typeof modelOutput?.text === 'string'
          ? modelOutput.text
          : `Task finished with status: ${job.status}`;
      const input = (job.input ?? {}) as Record<string, unknown>;
      const model =
        (input.model as string | undefined) ??
        (input.provider as string | undefined) ??
        (typeof modelOutput?.provider === 'string' ? modelOutput.provider : 'local');
      return {
        text,
        status: job.status,
        costUsd: job.costUsd ?? 0,
        tier: job.tier,
        model,
        sources: extractSources(job),
      };
    }
  }
  return {
    text: 'Task is still running. Check the tasks page for the final result.',
    status: 'running',
    costUsd: 0,
    tier: 1,
    model: 'local',
    sources: [],
  };
}

export default function ConsolePage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const [agentRoles, setAgentRoles] = useState<AgentRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<AgentRole | null>(null);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [budget, setBudget] = useState<number>(5);
  const [tier, setTier] = useState<0 | 1 | 2>(1);
  const [node, setNode] = useState<'auto' | 'laptop' | 'desktop' | 'cloud' | 'phone'>('auto');
  const [rawToolCalls, setRawToolCalls] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when message list grows
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // load available agent roles so the console is model-agnostic
  useEffect(() => {
    async function loadRoles() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/agents/`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('failed to load roles');
        const body = (await res.json()) as { roles: AgentRole[] };
        const roles = body.roles.filter((r) => r.kind === 'main');
        setAgentRoles(roles);
        setSelectedRole(roles[0] ?? null);
      } catch {
        // fall back to a minimal local role so the UI still renders
        const fallback = {
          id: 'local',
          kind: 'main',
          name: 'local',
          provider: 'local',
          tier: 0,
          capabilities: [],
          isDefault: true,
          priority: 0,
        } as unknown as AgentRole;
        setAgentRoles([fallback]);
        setSelectedRole(fallback);
      } finally {
        setRolesLoading(false);
      }
    }
    loadRoles();
  }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: UserMessage = { id: Date.now(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/tasks`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idempotencyKey: `console-${Date.now()}`,
          type: 'chat',
          prompt: text,
          payload: {},
          attachments: [],
          ...(selectedRole && { role: selectedRole.kind }),
          ...(selectedRole?.model && { model: selectedRole.model }),
          ...(selectedRole?.provider && { provider: selectedRole.provider }),
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? `HTTP ${res.status}`);
      }

      const body = (await res.json()) as { jobId: string; approvalId?: string; status?: string };
      const { jobId, approvalId } = body;

      if (res.status === 202 && approvalId) {
        const assistant: AssistantMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: 'This request requires approval before proceeding.',
          model: selectedRole?.model ?? selectedRole?.provider ?? 'local',
          confidence: 0.85,
          cost: 0,
          tier,
          jobId,
          needsApproval: {
            approvalId,
            title: text.slice(0, 80),
            blastRadius: `1 task · ${tier === 0 ? 'private' : tier === 1 ? 'local' : 'cloud'}`,
          },
        };
        setMessages((prev) => [...prev, assistant]);
        return;
      }

      const result = await pollJob(jobId);

      const assistant: AssistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.text,
        model: result.model,
        confidence: 0.85,
        cost: result.costUsd / 1_000_000,
        tier: result.tier,
        sources: result.sources,
      };
      setMessages((prev) => [...prev, assistant]);
    } catch (err) {
      const systemMsg: SystemMessage = {
        id: Date.now() + 1,
        role: 'system',
        variant: 'error',
        content: err instanceof Error ? err.message : 'Failed to reach Mimir API.',
      };
      setMessages((prev) => [...prev, systemMsg]);
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleApprove(msgId: number) {
    const msg = messages.find((m): m is AssistantMessage => isAssistant(m) && m.id === msgId);
    if (!msg?.needsApproval?.approvalId) return;

    setMessages((prev) =>
      prev.map((m) =>
        isAssistant(m) && m.id === msgId ? { ...m, content: `${m.content}\n\nApproving…` } : m
      )
    );

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/approvals/${msg.needsApproval.approvalId}/approve`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      if (!res.ok) throw new Error('Approval failed');

      if (msg.jobId) {
        const result = await pollJob(msg.jobId);
        setMessages((prev) =>
          prev.map((m) =>
            isAssistant(m) && m.id === msgId
              ? {
                  ...m,
                  content: result.text,
                  cost: result.costUsd / 1_000_000,
                  tier: result.tier,
                  model: result.model,
                  sources: result.sources,
                  needsApproval: undefined,
                }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            isAssistant(m) && m.id === msgId
              ? { ...m, content: `${m.content}\n\nApproved.`, needsApproval: undefined }
              : m
          )
        );
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          isAssistant(m) && m.id === msgId
            ? {
                ...m,
                content:
                  err instanceof Error
                    ? `${m.content}\n\nApproval error: ${err.message}`
                    : `${m.content}\n\nApproval error`,
              }
            : m
        )
      );
    }
  }

  async function handleDeny(msgId: number) {
    const msg = messages.find((m): m is AssistantMessage => isAssistant(m) && m.id === msgId);
    if (!msg?.needsApproval?.approvalId) {
      setMessages((prev) => prev.filter((m) => !isAssistant(m) || m.id !== msgId));
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/approvals/${msg.needsApproval.approvalId}/deny`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      if (!res.ok) throw new Error('Denial failed');
      setMessages((prev) =>
        prev.map((m) =>
          isAssistant(m) && m.id === msgId
            ? { ...m, content: `${m.content}\n\nDenied.`, needsApproval: undefined }
            : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          isAssistant(m) && m.id === msgId
            ? {
                ...m,
                content:
                  err instanceof Error
                    ? `${m.content}\n\nDenial error: ${err.message}`
                    : `${m.content}\n\nDenial error`,
              }
            : m
        )
      );
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-4xl flex-col gap-4 p-4">
      {offlineMode && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800"
        >
          Offline — local model active. Sensitive requests are staying on-device.
        </motion.div>
      )}

      <div className="flex-1 space-y-5 overflow-y-auto pr-2">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {isSystem(msg) ? (
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-4 py-2 text-xs font-medium',
                    msg.variant === 'error'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-amber-100 text-amber-800'
                  )}
                >
                  {msg.content}
                </div>
              ) : (
                <div
                  data-testid={msg.role === 'assistant' ? 'assistant-message' : undefined}
                  className={cn(
                    'max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'rounded-br-md bg-[var(--accent-primary)] text-white'
                      : 'rounded-bl-md bg-[var(--bg-surface)] shadow-card'
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {msg.role === 'user' ? (
                      <User className="h-4 w-4 opacity-80" />
                    ) : (
                      <Bot className="h-4 w-4 text-[var(--accent-primary)]" />
                    )}
                    <span
                      className={cn(
                        'text-xs',
                        msg.role === 'user' ? 'opacity-80' : 'text-[var(--text-muted)]'
                      )}
                    >
                      {msg.role === 'user' ? 'You' : 'Mimir'}
                    </span>
                  </div>

                  <p
                    className={cn(
                      msg.role === 'user' ? 'text-white' : 'text-[var(--text-primary)]'
                    )}
                  >
                    {msg.content}
                  </p>

                  {isAssistant(msg) && (
                    <>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <ModelBadge model={msg.model} />
                        <TierBadge tier={msg.tier} />
                        <TrustBadge model={msg.model} confidence={msg.confidence} />
                        <span className="text-xs text-[var(--text-muted)]">
                          ${msg.cost.toFixed(4)}
                        </span>
                        <SourcesChip sources={msg.sources ?? []} />
                      </div>

                      {msg.needsApproval && (
                        <ApprovalCard
                          className="mt-4"
                          title={msg.needsApproval.title}
                          blastRadius={msg.needsApproval.blastRadius}
                          tier={msg.tier}
                          onApprove={() => handleApprove(msg.id)}
                          onDeny={() => handleDeny(msg.id)}
                        />
                      )}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isStreaming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="rounded-2xl rounded-bl-md bg-[var(--bg-surface)] px-5 py-3.5 shadow-card">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Mimir is thinking…
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {showSteps && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-xl bg-[var(--bg-surface)] p-3 shadow-card"
            >
              <h4 className="mb-2 text-xs font-semibold text-[var(--text-primary)]">
                Execution plan
              </h4>
              <ol className="space-y-1.5">
                {steps.map((step, i) => (
                  <li
                    key={step}
                    className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent-primary)]/10 text-[10px] font-medium text-[var(--accent-primary)]">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="glass rounded-2xl p-2 shadow-lg">
          <div className="flex items-end gap-2">
            <div className="relative">
              <button
                type="button"
                aria-label="Attachments"
                aria-expanded={showAttachments}
                onClick={() => setShowAttachments((v) => !v)}
                className={cn(
                  'rounded-xl p-2.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)]',
                  showAttachments && 'bg-[var(--bg-surface-raised)] text-[var(--accent-primary)]'
                )}
              >
                <Paperclip className="h-5 w-5" />
              </button>
              {showAttachments && (
                <div className="absolute bottom-full left-0 mb-2 w-40 rounded-xl border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-1 shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
                  >
                    <FileText className="h-4 w-4" /> File
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
                  >
                    <FileImage className="h-4 w-4" /> Image
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-raised)]"
                  >
                    <Mic className="h-4 w-4" /> Voice
                  </button>
                </div>
              )}
            </div>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Mimir anything..."
              rows={1}
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-3 text-sm outline-none placeholder:text-[var(--text-muted)]"
            />

            <button
              type="button"
              aria-label="Voice input"
              className="rounded-xl p-2.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)]"
            >
              <Mic className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              aria-label="Send"
              className={cn(
                'rounded-xl p-2.5 text-white shadow-md transition-all hover:shadow-glow-indigo',
                input.trim() && !isStreaming
                  ? 'bg-[var(--accent-primary)]'
                  : 'cursor-not-allowed bg-[var(--text-muted)]'
              )}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center justify-between px-3 pb-1 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSteps((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                  showSteps
                    ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-secondary)]'
                )}
              >
                <Play className="h-3 w-3" />
                {showSteps ? 'Hide steps' : 'Show steps'}
              </button>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                  showAdvanced
                    ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-secondary)]'
                )}
              >
                <Settings2 className="h-3 w-3" />
                Advanced
                {showAdvanced ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <Slash className="h-3 w-3" /> for skills
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">
              T{tier} · {node === 'auto' ? 'Auto node' : node}
            </span>
          </div>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-[var(--border-subtle-solid)] px-3 pb-3 pt-3">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        Model
                      </span>
                      <div className="flex gap-1">
                        {rolesLoading ? (
                          <span className="text-xs text-[var(--text-muted)]">loading roles…</span>
                        ) : (
                          agentRoles.map((role) => (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => setSelectedRole(role)}
                              className={cn(
                                'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                selectedRole?.id === role.id
                                  ? 'bg-[var(--accent-primary)] text-white'
                                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                              )}
                            >
                              {role.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        Privacy tier
                      </span>
                      <div className="flex gap-1">
                        {[0, 1, 2].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTier(t as 0 | 1 | 2)}
                            className={cn(
                              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                              tier === t
                                ? 'bg-[var(--accent-primary)] text-white'
                                : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                            )}
                          >
                            T{t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        Target node
                      </span>
                      <select
                        value={node}
                        onChange={(e) => setNode(e.target.value as typeof node)}
                        className="w-full rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] px-2 py-1 text-xs text-[var(--text-secondary)] outline-none focus:border-[var(--border-focus)]"
                      >
                        <option value="auto">Auto</option>
                        <option value="laptop">Laptop brain</option>
                        <option value="desktop">Desktop worker</option>
                        <option value="cloud">Cloud worker</option>
                        <option value="phone">Phone</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                        Budget (${budget})
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={20}
                        step={1}
                        value={budget}
                        onChange={(e) => setBudget(Number(e.target.value))}
                        className="w-full accent-[var(--accent-primary)]"
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={rawToolCalls}
                        onChange={(e) => setRawToolCalls(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-[var(--border-subtle-solid)] text-[var(--accent-primary)]"
                      />
                      Show raw tool calls
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <input
                        type="checkbox"
                        checked={offlineMode}
                        onChange={(e) => setOfflineMode(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-[var(--border-subtle-solid)] text-[var(--accent-primary)]"
                      />
                      Offline mode
                    </label>
                  </div>

                  {rawToolCalls && (
                    <div className="mt-3 rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-primary)] p-2 font-mono text-[10px] text-[var(--text-muted)]">
                      {`> classify_tier(text="${input.slice(0, 40)}...")\n> route_node(tier=${tier}, node=${node})\n> delegate_role(role=${selectedRole?.kind ?? 'main'}, budget=${budget})`}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
