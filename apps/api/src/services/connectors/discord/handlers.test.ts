import { beforeEach, describe, expect, it, vi } from 'vitest';
import { discordChatApplyHandler } from './handlers';

const sendDmMock = vi.fn().mockResolvedValue({ id: 'msg-2' });
const sendMessageMock = vi.fn().mockResolvedValue({ id: 'msg-2' });

vi.mock('./client', () => ({
  DiscordClient: vi.fn().mockImplementation(() => ({
    sendDm: (...args: unknown[]) => sendDmMock(...args),
    sendMessage: (...args: unknown[]) => sendMessageMock(...args),
  })),
}));

vi.mock('../../../repositories/connector', () => ({
  findConnectorByKind: vi.fn().mockResolvedValue({
    id: 'connector-1',
    kind: 'discord',
    secretRef: 'discord',
  }),
}));

vi.mock('../../../repositories/session', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'msg-2' }),
}));

describe('discordChatApplyHandler', () => {
  beforeEach(() => {
    sendDmMock.mockClear();
    sendMessageMock.mockClear();
  });

  it('sends the model reply as a DM and stores an assistant message', async () => {
    const ctx = {
      tenantId: 'tenant-1',
      tenantScopedDb: {} as never,
      ensureTenantExists: vi.fn(),
    };

    const input = {
      tenantId: 'tenant-1',
      userId: 'discord:42',
      jobId: 'job-1',
      idempotencyKey: 'key-1',
      type: 'discord.chat',
      tier: 1,
      payload: {
        recipientId: '42',
        sessionId: 'session-1',
      },
    };

    const draft = {
      success: true,
      artifacts: {
        model: {
          text: 'Here is what you need from your laptop.',
          model: 'gpt-4',
          provider: 'openai',
          tier: 1,
        },
      },
      log: [],
    };

    const result = await discordChatApplyHandler(ctx, input, draft, { approved: true });

    expect(result.applied).toBe(true);
    expect(sendDmMock).toHaveBeenCalledWith({
      recipientId: '42',
      content: 'Here is what you need from your laptop.',
    });
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('falls back to channel message when no recipient is provided', async () => {
    const ctx = {
      tenantId: 'tenant-1',
      tenantScopedDb: {} as never,
      ensureTenantExists: vi.fn(),
    };

    const input = {
      tenantId: 'tenant-1',
      userId: 'discord:42',
      jobId: 'job-1',
      idempotencyKey: 'key-1',
      type: 'discord.chat',
      tier: 1,
      payload: {
        channelId: '99',
        sessionId: 'session-1',
      },
    };

    const draft = {
      success: true,
      artifacts: {
        model: {
          text: 'Channel reply.',
          model: 'gpt-4',
          provider: 'openai',
          tier: 1,
        },
      },
      log: [],
    };

    const result = await discordChatApplyHandler(ctx, input, draft, { approved: true });

    expect(result.applied).toBe(true);
    expect(sendMessageMock).toHaveBeenCalledWith({ channelId: '99', content: 'Channel reply.' });
    expect(sendDmMock).not.toHaveBeenCalled();
  });

  it('returns not applied when the model produced no text', async () => {
    const ctx = {
      tenantId: 'tenant-1',
      tenantScopedDb: {} as never,
      ensureTenantExists: vi.fn(),
    };

    const input = {
      tenantId: 'tenant-1',
      userId: 'discord:42',
      jobId: 'job-1',
      idempotencyKey: 'key-1',
      type: 'discord.chat',
      tier: 1,
      payload: {
        recipientId: '42',
        sessionId: 'session-1',
      },
    };

    const draft = {
      success: true,
      artifacts: {},
      log: [],
    };

    const result = await discordChatApplyHandler(ctx, input, draft, { approved: true });

    expect(result.applied).toBe(false);
    expect(sendDmMock).not.toHaveBeenCalled();
  });
});
