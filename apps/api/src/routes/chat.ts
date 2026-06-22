import {
  type ChatChannel,
  type ChatChannelListResponse,
  type ChatMessage,
  type ChatMessageListResponse,
  CreateChatChannelRequest,
  CreateChatMessageRequest,
  ListChatMessagesQuery,
} from '@mimir/shared-types';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type * as schema from '../db/schema';
import { withTenantTransaction } from '../db/tenant-context';
import { Scopes, requireScope } from '../middleware/rbac';
import { protectedRouteConfig } from '../middleware/route-config';
import {
  createChatChannel,
  createChatMessage,
  getChatChannelById,
  listChatChannelsForUser,
  listChatMessages,
} from '../repositories/chat';

const uuidParams = z.object({
  id: z.string().uuid(),
});

type ChannelWithParticipants = typeof schema.chatChannel.$inferSelect & {
  participants: (typeof schema.chatParticipant.$inferSelect)[];
};

function toChannelResponse(channel: ChannelWithParticipants): z.infer<typeof ChatChannel> {
  return {
    id: channel.id,
    tenantId: channel.tenantId,
    title: channel.title,
    createdByUserAccountId: channel.createdByUserAccountId,
    createdAt: channel.createdAt.toISOString(),
    participants: channel.participants.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      channelId: p.channelId,
      userAccountId: p.userAccountId,
      encryptedChannelKey: p.encryptedChannelKey,
      joinedAt: p.joinedAt.toISOString(),
    })),
  };
}

function toMessageResponse(
  message: Awaited<ReturnType<typeof createChatMessage>>
): z.infer<typeof ChatMessage> {
  return {
    id: message.id,
    tenantId: message.tenantId,
    channelId: message.channelId,
    senderUserAccountId: message.senderUserAccountId,
    encryptedPayload: message.encryptedPayload as { ciphertext: string; iv: string; salt?: string },
    createdAt: message.createdAt.toISOString(),
  };
}

export async function chatRoutes(app: FastifyInstance) {
  app.post(
    '/channels',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.CHAT_WRITE) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const body = CreateChatChannelRequest.parse(request.body);

      const channel = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createChatChannel(ctx, {
          title: body.title,
          createdByUserAccountId: user.userAccountId,
          participants: [
            {
              userAccountId: user.userAccountId,
              encryptedChannelKey: body.encryptedChannelKey,
            },
          ],
        });
      });

      return reply.status(201).send(toChannelResponse(channel));
    }
  );

  app.get(
    '/channels',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.CHAT_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const channels = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listChatChannelsForUser(ctx, user.userAccountId);
      });

      const response: ChatChannelListResponse = {
        data: channels.map((c) => toChannelResponse(c)),
      };
      return reply.send(response);
    }
  );

  app.get(
    '/channels/:id',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.CHAT_READ) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = uuidParams.parse(request.params);
      const channel = await withTenantTransaction(user.tenantId, async (ctx) => {
        return getChatChannelById(ctx, params.id, user.userAccountId);
      });

      if (!channel) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Channel not found' } });
      }

      return reply.send(toChannelResponse(channel));
    }
  );

  app.post(
    '/channels/:id/messages',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.CHAT_WRITE) },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = uuidParams.parse(request.params);
      const body = CreateChatMessageRequest.parse(request.body);
      const message = await withTenantTransaction(user.tenantId, async (ctx) => {
        return createChatMessage(ctx, {
          channelId: params.id,
          senderUserAccountId: user.userAccountId,
          encryptedPayload: body.encryptedPayload,
        });
      });

      return reply.status(201).send(toMessageResponse(message));
    }
  );

  app.get(
    '/channels/:id/messages',
    { config: protectedRouteConfig, preHandler: requireScope(Scopes.CHAT_READ) },
    async (request: FastifyRequest, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const params = uuidParams.parse(request.params);
      const query = ListChatMessagesQuery.parse(request.query);
      const messages = await withTenantTransaction(user.tenantId, async (ctx) => {
        return listChatMessages(ctx, params.id, user.userAccountId, {
          limit: query.limit,
          before: query.before,
        });
      });

      const response: ChatMessageListResponse = {
        data: messages.map((m) => toMessageResponse(m)),
      };
      return reply.send(response);
    }
  );
}
