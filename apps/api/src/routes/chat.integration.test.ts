import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test-helpers/build-app';
import { chatRoutes } from './chat';

describe('chat routes', () => {
  it('returns 401 without an authorization header', async () => {
    const app = await buildTestApp(async (app) => {
      await app.register(chatRoutes, { prefix: '/v1/chat' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/chat/channels',
    });

    expect(response.statusCode).toBe(401);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'creates a channel and sends encrypted messages',
    async () => {
      const token = `chat_user_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(chatRoutes, { prefix: '/v1/chat' });
      });

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/chat/channels',
        headers: { authorization: `Bearer ${token}` },
        payload: {
          title: 'Secret channel',
          encryptedChannelKey: JSON.stringify({ ciphertext: 'abc', iv: 'def', salt: 'ghi' }),
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const channel = JSON.parse(createResponse.body);
      expect(channel.title).toBe('Secret channel');
      expect(channel.participants.length).toBe(1);

      const listResponse = await app.inject({
        method: 'GET',
        url: '/v1/chat/channels',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(listResponse.statusCode).toBe(200);
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data.length).toBe(1);

      const messagePayload = { ciphertext: 'encrypted-text', iv: 'iv-value' };
      const messageResponse = await app.inject({
        method: 'POST',
        url: `/v1/chat/channels/${channel.id}/messages`,
        headers: { authorization: `Bearer ${token}` },
        payload: { encryptedPayload: messagePayload },
      });
      expect(messageResponse.statusCode).toBe(201);
      const message = JSON.parse(messageResponse.body);
      expect(message.encryptedPayload).toEqual(messagePayload);

      const messagesResponse = await app.inject({
        method: 'GET',
        url: `/v1/chat/channels/${channel.id}/messages`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(messagesResponse.statusCode).toBe(200);
      const messagesBody = JSON.parse(messagesResponse.body);
      expect(messagesBody.data.length).toBe(1);
    }
  );

  it.skipIf(!process.env.RUN_DB_TESTS)('returns 404 for a missing channel', async () => {
    const token = `chat_user_${Date.now()}`;
    const app = await buildTestApp(async (app) => {
      await app.register(chatRoutes, { prefix: '/v1/chat' });
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/chat/channels/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
  });

  it.skipIf(!process.env.RUN_DB_TESTS)(
    'returns 403 when posting to a non-participant channel',
    async () => {
      const tokenA = `chat_user_a_${Date.now()}`;
      const tokenB = `chat_user_b_${Date.now()}`;
      const app = await buildTestApp(async (app) => {
        await app.register(chatRoutes, { prefix: '/v1/chat' });
      });

      const createResponse = await app.inject({
        method: 'POST',
        url: '/v1/chat/channels',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          title: 'Private channel',
          encryptedChannelKey: JSON.stringify({ ciphertext: 'abc', iv: 'def', salt: 'ghi' }),
        },
      });
      const channel = JSON.parse(createResponse.body);

      const response = await app.inject({
        method: 'POST',
        url: `/v1/chat/channels/${channel.id}/messages`,
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { encryptedPayload: { ciphertext: 'x', iv: 'y' } },
      });

      expect(response.statusCode).toBe(403);
    }
  );
});
