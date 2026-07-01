'use client';

import { cn } from '@/lib/utils';
import type { ConnectorSetupMetadata } from '@mimir/shared-types';
import { Check, Copy, Eye, EyeOff, Plug, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

export type ConnectorSetupPanelProps = {
  kind: string;
  metadata: ConnectorSetupMetadata;
  webhookUrl?: string;
  account?: string;
  onAccountChange?: (value: string) => void;
  secrets: Record<string, string>;
  onSecretChange: (key: string, value: string) => void;
  onConnect: () => void;
  onTest?: () => void;
  onOAuthConnect?: () => void;
  oauthLoading?: boolean;
  loading?: boolean;
  testStatus?: 'idle' | 'loading' | 'success' | 'error';
  testError?: string;
  error?: string;
};

function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined') {
    void navigator.clipboard.writeText(text);
  }
}

function SecretInput({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[11px] font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={revealed ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2 pr-8 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        />
        <button
          type="button"
          onClick={() => setRevealed((prev) => !prev)}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)]"
          aria-label={revealed ? 'Hide secret' : 'Reveal secret'}
        >
          {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

function WebhookUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    copyToClipboard(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-1">
      <span className="text-[11px] font-medium text-[var(--text-secondary)]">Webhook URL</span>
      <div className="flex items-center gap-2 rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2 py-1.5">
        <code className="flex-1 truncate text-[10px] text-[var(--text-primary)]">{url}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)]"
          aria-label="Copy webhook URL"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <p className="text-[10px] text-[var(--text-muted)]">
        Paste this URL into the platform&apos;s webhook configuration.
      </p>
    </div>
  );
}

export function ConnectorSetupPanel({
  kind,
  metadata,
  webhookUrl,
  account,
  onAccountChange,
  secrets,
  onSecretChange,
  onConnect,
  onTest,
  onOAuthConnect,
  oauthLoading,
  loading,
  testStatus,
  testError,
  error,
}: ConnectorSetupPanelProps) {
  const resolvedWebhookUrl = webhookUrl ?? metadata.webhookUrl;
  const allSecretsFilled = metadata.fields.every((field) => secrets[field.key]?.trim().length > 0);

  return (
    <div className="space-y-3">
      {metadata.instructions && (
        <div className="rounded-lg bg-[var(--bg-surface-raised)] p-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          {metadata.instructions}
        </div>
      )}

      {metadata.oauthAvailable && onOAuthConnect && (
        <button
          type="button"
          onClick={onOAuthConnect}
          disabled={oauthLoading}
          className={cn(
            'inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            oauthLoading
              ? 'cursor-not-allowed bg-[var(--bg-surface-raised)] text-[var(--text-muted)]'
              : 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
          )}
        >
          {oauthLoading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plug className="h-3.5 w-3.5" />
          )}
          Connect with {kind.charAt(0).toUpperCase() + kind.slice(1)}
        </button>
      )}

      {metadata.accountLabel && onAccountChange && (
        <div className="space-y-1">
          <label
            htmlFor={`${kind}-account`}
            className="text-[11px] font-medium text-[var(--text-secondary)]"
          >
            {metadata.accountLabel}
          </label>
          <input
            id={`${kind}-account`}
            type="text"
            placeholder={metadata.accountLabel}
            value={account ?? ''}
            onChange={(e) => onAccountChange(e.target.value)}
            className="h-8 w-full rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          />
        </div>
      )}

      {metadata.fields.map((field) => (
        <SecretInput
          key={field.key}
          id={`${kind}-${field.key}`}
          label={field.label}
          placeholder={field.placeholder}
          value={secrets[field.key] ?? ''}
          onChange={(value) => onSecretChange(field.key, value)}
        />
      ))}

      {resolvedWebhookUrl && <WebhookUrl url={resolvedWebhookUrl} />}

      {error && (
        <div className="flex items-center gap-1.5 rounded-md bg-[var(--accent-danger)]/10 px-2 py-1.5 text-[11px] text-[var(--accent-danger)]">
          <X className="h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {onTest && (
          <button
            type="button"
            onClick={onTest}
            disabled={loading || testStatus === 'loading' || !allSecretsFilled}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
              testStatus === 'success'
                ? 'bg-[var(--accent-success)]/10 text-[var(--accent-success)]'
                : testStatus === 'error'
                  ? 'bg-[var(--accent-danger)]/10 text-[var(--accent-danger)]'
                  : 'bg-[var(--bg-surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]'
            )}
          >
            {testStatus === 'loading' ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : testStatus === 'success' ? (
              <Check className="h-3.5 w-3.5" />
            ) : testStatus === 'error' ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {testStatus === 'success' ? 'Connected' : testStatus === 'error' ? 'Failed' : 'Test'}
          </button>
        )}
        <button
          type="button"
          onClick={onConnect}
          disabled={loading || oauthLoading || !allSecretsFilled}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
            loading || !allSecretsFilled
              ? 'cursor-not-allowed bg-[var(--accent-primary)]/50 text-white'
              : 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary)]/90'
          )}
        >
          {loading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plug className="h-3.5 w-3.5" />
          )}
          Connect
        </button>
      </div>

      {testStatus === 'error' && testError && (
        <p className="text-[10px] text-[var(--accent-danger)]">{testError}</p>
      )}
    </div>
  );
}
