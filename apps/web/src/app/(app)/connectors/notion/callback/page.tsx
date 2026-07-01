'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function NotionOAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Completing Notion authorization...');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Notion authorization failed: ${error}`);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Missing authorization code or state.');
      return;
    }

    fetch('/api/v1/connectors/notion/oauth/callback', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus('success');
          setMessage('Notion connected successfully.');
          router.replace('/connectors');
        } else {
          const body = await res.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(body.error?.message ?? 'Failed to complete Notion authorization');
        }
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : String(err));
      });
  }, [searchParams, router]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">Notion authorization</h1>
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
      {status === 'error' && (
        <a
          href="/connectors"
          className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-primary)]/90"
        >
          Back to connectors
        </a>
      )}
    </div>
  );
}
