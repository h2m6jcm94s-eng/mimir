import { describe, expect, it, vi } from 'vitest';
import { TelegramClient } from './client';

const resolver = {
  get: vi.fn(),
  getForTenant: vi.fn().mockResolvedValue('bot-token'),
  setForTenant: vi.fn().mockResolvedValue(undefined),
  getRequired: vi.fn().mockResolvedValue('bot-token'),
  getRequiredForTenant: vi.fn().mockResolvedValue('bot-token'),
};

describe('TelegramClient', () => {
  it('getChat calls the Telegram Bot API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { id: 1, title: 'Chat' } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new TelegramClient({ tenantId: 't1', secretRef: 'telegram' }, resolver);
    const result = await client.getChat({ chatId: '@channel' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/getChat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ chat_id: '@channel' }),
      })
    );
    expect(result).toEqual({ ok: true, result: { id: 1, title: 'Chat' } });
  });

  it('sendMessage calls the Telegram Bot API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new TelegramClient({ tenantId: 't1', secretRef: 'telegram' }, resolver);
    const result = await client.sendMessage({ chatId: 123, text: 'hello' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/sendMessage',
      expect.objectContaining({
        body: JSON.stringify({ chat_id: 123, text: 'hello' }),
      })
    );
    expect(result).toEqual({ ok: true, result: { message_id: 42 } });
  });

  it('setWebhook calls the Telegram Bot API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new TelegramClient({ tenantId: 't1', secretRef: 'telegram' }, resolver);
    const result = await client.setWebhook({
      url: 'https://mimir.example.com/webhooks/telegram/t1',
      secretToken: 'secret',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/botbot-token/setWebhook',
      expect.objectContaining({
        body: JSON.stringify({
          url: 'https://mimir.example.com/webhooks/telegram/t1',
          secret_token: 'secret',
          allowed_updates: ['message', 'edited_message'],
        }),
      })
    );
    expect(result).toEqual({ ok: true, result: true });
  });
});
