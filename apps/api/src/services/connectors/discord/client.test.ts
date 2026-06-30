import { describe, expect, it, vi } from 'vitest';
import { DiscordClient } from './client';

const resolver = {
  get: vi.fn(),
  getForTenant: vi.fn().mockResolvedValue('bot-token'),
  getRequired: vi.fn().mockResolvedValue('bot-token'),
  getRequiredForTenant: vi.fn().mockResolvedValue('bot-token'),
};

describe('DiscordClient', () => {
  it('listChannels calls the Discord API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1', name: 'general' }],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new DiscordClient({ tenantId: 't1', secretRef: 'discord' }, resolver);
    const result = await client.listChannels({ guildId: 'g1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/guilds/g1/channels',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bot bot-token' }),
      })
    );
    expect(result).toEqual([{ id: '1', name: 'general' }]);
  });

  it('sendMessage calls the Discord API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg-1', content: 'hello' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new DiscordClient({ tenantId: 't1', secretRef: 'discord' }, resolver);
    const result = await client.sendMessage({ channelId: 'c1', content: 'hello' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/c1/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: 'hello' }),
      })
    );
    expect(result).toEqual({ id: 'msg-1', content: 'hello' });
  });

  it('sendDm creates a DM channel and sends a message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'dm-1' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new DiscordClient({ tenantId: 't1', secretRef: 'discord' }, resolver);
    await client.sendDm({ recipientId: 'u1', content: 'hello dm' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/users/@me/channels',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ recipient_id: 'u1' }),
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/channels/dm-1/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: 'hello dm' }),
      })
    );
  });
});
