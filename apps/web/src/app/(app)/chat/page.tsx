'use client';

import {
  type EncryptedMessagePayload,
  type WrappedKey,
  decryptMessage,
  encryptMessage,
  generateChannelKey,
  unwrapChannelKey,
  wrapChannelKey,
} from '@/lib/chat-crypto';
import type { ChatChannel, ChatMessage } from '@mimir/shared-types';
import { Lock, MessageSquare, Plus, Send, Unlock } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export default function ChatPage() {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [channelKeys, setChannelKeys] = useState<Record<string, CryptoKey>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [title, setTitle] = useState('');
  const [createPassphrase, setCreatePassphrase] = useState('');
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => channels.find((c) => c.id === selectedId) ?? null,
    [channels, selectedId]
  );

  const loadChannels = useCallback(async () => {
    const response = await fetchJson<{ data: ChatChannel[] }>('/api/v1/chat/channels');
    setChannels(response.data);
  }, []);

  useEffect(() => {
    loadChannels().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [loadChannels]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    fetchJson<{ data: ChatMessage[] }>(`/api/v1/chat/channels/${selectedId}/messages`)
      .then((res) => setMessages(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [selectedId]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      const channelKey = await generateChannelKey();
      const encryptedChannelKey = await wrapChannelKey(channelKey, createPassphrase);
      const created = await fetchJson<ChatChannel>('/api/v1/chat/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, encryptedChannelKey: JSON.stringify(encryptedChannelKey) }),
      });
      setChannelKeys((prev) => ({ ...prev, [created.id]: channelKey }));
      setTitle('');
      setCreatePassphrase('');
      setSelectedId(created.id);
      await loadChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleUnlock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    try {
      let key: CryptoKey | undefined;
      for (const participant of selected.participants) {
        try {
          const wrapped: WrappedKey = JSON.parse(participant.encryptedChannelKey);
          key = await unwrapChannelKey(wrapped, unlockPassphrase);
          break;
        } catch {
          // try next participant
        }
      }
      if (!key) {
        setError('Incorrect passphrase');
        return;
      }
      const unlockedKey = key;
      setChannelKeys((prev) => ({ ...prev, [selected.id]: unlockedKey }));
      setUnlockPassphrase('');
      const res = await fetchJson<{ data: ChatMessage[] }>(
        `/api/v1/chat/channels/${selected.id}/messages`
      );
      setMessages(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected || !channelKeys[selected.id]) return;
    setError(null);
    try {
      const encryptedPayload = await encryptMessage(messageText, channelKeys[selected.id]);
      await fetchJson<ChatMessage>(`/api/v1/chat/channels/${selected.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedPayload }),
      });
      setMessageText('');
      const res = await fetchJson<{ data: ChatMessage[] }>(
        `/api/v1/chat/channels/${selected.id}/messages`
      );
      setMessages(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function tryDecrypt(payload: EncryptedMessagePayload): Promise<string | undefined> {
    if (!selected) return undefined;
    const key = channelKeys[selected.id];
    if (!key) return undefined;
    try {
      return await decryptMessage(payload, key);
    } catch {
      return undefined;
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-4 p-4 md:flex-row">
      <aside className="flex w-full flex-col gap-4 md:w-72">
        <div className="rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <MessageSquare className="h-4 w-4" />
            Encrypted chats
          </h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label
                htmlFor="chat-title"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                New channel title
              </label>
              <input
                id="chat-title"
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="e.g. Family plans"
                data-testid="chat-channel-title"
                className="mt-1 w-full rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label
                htmlFor="chat-passphrase"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Passphrase
              </label>
              <input
                id="chat-passphrase"
                type="password"
                value={createPassphrase}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setCreatePassphrase(e.target.value)
                }
                placeholder="Used to encrypt this channel"
                data-testid="chat-channel-passphrase"
                className="mt-1 w-full rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <button
              type="submit"
              data-testid="chat-create-channel"
              className="flex w-full items-center justify-center rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
            >
              <Plus className="mr-1 h-4 w-4" />
              Create channel
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-auto rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] p-2">
          {channels.length === 0 && (
            <p className="p-2 text-xs text-[var(--text-tertiary)]">No channels yet.</p>
          )}
          <ul className="space-y-1">
            {channels.map((channel) => {
              const unlocked = !!channelKeys[channel.id];
              return (
                <li key={channel.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(channel.id)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      selectedId === channel.id
                        ? 'bg-[var(--bg-surface-raised)] text-[var(--accent-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-raised)]'
                    }`}
                    data-testid={`chat-channel-${channel.id}`}
                  >
                    <span className="truncate">{channel.title}</span>
                    {unlocked ? (
                      <Unlock className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)]">
        {selected ? (
          <>
            <div className="border-b border-[var(--border-subtle-solid)] px-4 py-3">
              <h1 className="text-base font-semibold text-[var(--text-primary)]">
                {selected.title}
              </h1>
              <p className="text-xs text-[var(--text-tertiary)]">
                End-to-end encrypted. Mimir cannot read these messages.
              </p>
            </div>

            {!channelKeys[selected.id] && (
              <div className="border-b border-[var(--border-subtle-solid)] px-4 py-3">
                <form onSubmit={handleUnlock} className="flex items-end gap-2">
                  <div className="flex-1">
                    <label
                      htmlFor="unlock-passphrase"
                      className="block text-xs font-medium text-[var(--text-secondary)]"
                    >
                      Unlock channel
                    </label>
                    <input
                      id="unlock-passphrase"
                      type="password"
                      value={unlockPassphrase}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setUnlockPassphrase(e.target.value)
                      }
                      placeholder="Enter channel passphrase"
                      data-testid="chat-unlock-passphrase"
                      className="mt-1 w-full rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                  <button
                    type="submit"
                    data-testid="chat-unlock-channel"
                    className="flex items-center gap-1 rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90"
                  >
                    <Unlock className="h-4 w-4" />
                    Unlock
                  </button>
                </form>
              </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <p className="text-sm text-[var(--text-tertiary)]">No messages yet.</p>
              )}
              {[...messages].reverse().map((message) => (
                <MessageBubble key={message.id} message={message} decrypt={tryDecrypt} />
              ))}
            </div>

            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 border-t border-[var(--border-subtle-solid)] p-3"
            >
              <input
                value={messageText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setMessageText(e.target.value)
                }
                placeholder={
                  channelKeys[selected.id]
                    ? 'Type an encrypted message...'
                    : 'Unlock channel to send'
                }
                disabled={!channelKeys[selected.id]}
                data-testid="chat-message-input"
                className="flex-1 rounded-md border border-[var(--border-subtle-solid)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!channelKeys[selected.id] || !messageText.trim()}
                data-testid="chat-send-message"
                className="flex items-center gap-1 rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-primary)]/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-tertiary)]">
            Select or create a channel to start an encrypted chat.
          </div>
        )}

        {error && (
          <div className="border-t border-[var(--border-subtle-solid)] bg-red-50 px-4 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

function MessageBubble({
  message,
  decrypt,
}: {
  message: ChatMessage;
  decrypt: (payload: EncryptedMessagePayload) => Promise<string | undefined>;
}) {
  const [plain, setPlain] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    decrypt(message.encryptedPayload).then((text) => {
      if (!cancelled) setPlain(text);
    });
    return () => {
      cancelled = true;
    };
  }, [message, decrypt]);

  return (
    <div className="max-w-[80%] rounded-lg bg-[var(--bg-surface-raised)] px-3 py-2">
      {plain !== undefined ? (
        <p className="text-sm text-[var(--text-primary)]" data-testid="chat-decrypted-message">
          {plain}
        </p>
      ) : (
        <p className="text-xs text-[var(--text-tertiary)]">🔒 Encrypted message</p>
      )}
      <time className="mt-1 block text-[10px] text-[var(--text-tertiary)]">
        {new Date(message.createdAt).toLocaleString()}
      </time>
    </div>
  );
}
