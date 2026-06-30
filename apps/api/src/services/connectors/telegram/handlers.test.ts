import { beforeEach, describe, expect, it, vi } from 'vitest';
import { telegramChatApplyHandler } from './handlers';

const sendMessageMock = vi.fn().mockResolvedValue({ message_id: 2 });

vi.mock('./client', () => ({
  TelegramClient: vi.fn().mockImplementation(() => ({
    sendMessage: (...args: unknown[]) => sendMessageMock(...args),
  })),
}));

vi.mock('../../../repositories/connector', () => ({
  findConnectorByKind: vi.fn().mockResolvedValue({
    id: 'connector-1',
    kind: 'telegram',
    secretRef: 'telegram',
  }),
}));

vi.mock('../../../repositories/session', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'msg-2' }),
}));

describe('telegramChatApplyHandler', () => {
  beforeEach(() => {
    sendMessageMock.mockClear();
  });

  it('sends the model reply and stores an assistant message', async () => {
    const ctx = {
      tenantId: 'tenant-1',
      tenantScopedDb: {} as never,
      ensureTenantExists: vi.fn(),
    };

    const input = {
      tenantId: 'tenant-1',
      userId: 'telegram:42',
      jobId: 'job-1',
      idempotencyKey: 'key-1',
      type: 'telegram.chat',
      tier: 1,
      payload: {
        chatId: 99,
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

    const result = await telegramChatApplyHandler(ctx, input, draft, { approved: true });

    expect(result.applied).toBe(true);
    expect(sendMessageMock).toHaveBeenCalledWith({
      chatId: 99,
      text: 'Here is what you need from your laptop.',
    });
  });

  it('returns not applied when the model produced no text', async () => {
    const ctx = {
      tenantId: 'tenant-1',
      tenantScopedDb: {} as never,
      ensureTenantExists: vi.fn(),
    };

    const input = {
      tenantId: 'tenant-1',
      userId: 'telegram:42',
      jobId: 'job-1',
      idempotencyKey: 'key-1',
      type: 'telegram.chat',
      tier: 1,
      payload: {
        chatId: 99,
        sessionId: 'session-1',
      },
    };

    const draft = {
      success: true,
      artifacts: {},
      log: [],
    };

    const result = await telegramChatApplyHandler(ctx, input, draft, { approved: true });

    expect(result.applied).toBe(false);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});
