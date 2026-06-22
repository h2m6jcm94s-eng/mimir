import { z } from 'zod';

export const EncryptedPayload = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  salt: z.string().optional(),
});
export type EncryptedPayload = z.infer<typeof EncryptedPayload>;

export const ChatParticipantInput = z.object({
  userAccountId: z.string().uuid(),
  encryptedChannelKey: z.string().min(1),
});
export type ChatParticipantInput = z.infer<typeof ChatParticipantInput>;

export const CreateChatChannelRequest = z.object({
  title: z.string().min(1).max(255),
  encryptedChannelKey: z.string().min(1),
});
export type CreateChatChannelRequest = z.infer<typeof CreateChatChannelRequest>;

export const ChatParticipant = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  channelId: z.string().uuid(),
  userAccountId: z.string().uuid(),
  encryptedChannelKey: z.string(),
  joinedAt: z.string().datetime(),
});
export type ChatParticipant = z.infer<typeof ChatParticipant>;

export const ChatChannel = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string(),
  createdByUserAccountId: z.string().uuid(),
  createdAt: z.string().datetime(),
  participants: z.array(ChatParticipant),
});
export type ChatChannel = z.infer<typeof ChatChannel>;

export const ChatChannelListResponse = z.object({
  data: z.array(ChatChannel),
});
export type ChatChannelListResponse = z.infer<typeof ChatChannelListResponse>;

export const CreateChatMessageRequest = z.object({
  encryptedPayload: EncryptedPayload,
});
export type CreateChatMessageRequest = z.infer<typeof CreateChatMessageRequest>;

export const ChatMessage = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  channelId: z.string().uuid(),
  senderUserAccountId: z.string().uuid(),
  encryptedPayload: EncryptedPayload,
  createdAt: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ChatMessageListResponse = z.object({
  data: z.array(ChatMessage),
  nextCursor: z.string().datetime().optional(),
});
export type ChatMessageListResponse = z.infer<typeof ChatMessageListResponse>;

export const ListChatMessagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.string().datetime().optional(),
});
export type ListChatMessagesQuery = z.infer<typeof ListChatMessagesQuery>;
