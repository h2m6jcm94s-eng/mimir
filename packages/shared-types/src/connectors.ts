import { z } from 'zod';

export const ConnectorKind = z.enum([
  'github',
  'telegram',
  'whatsapp',
  'instagram',
  'facebook',
  'pinterest',
  'gmail',
  'microsoftGraph',
  'slack',
  'discord',
  'airtable',
  'googleContacts',
  'googleDocs',
  'stripe',
  'lemonSqueezy',
  'paddle',
  'csv',
  'xlsx',
  'googleSheets',
  'notion',
]);
export type ConnectorKind = z.infer<typeof ConnectorKind>;

export const ConnectorStatus = z.enum(['connected', 'disconnected', 'error']);
export type ConnectorStatus = z.infer<typeof ConnectorStatus>;

export const ConnectorTier = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type ConnectorTier = z.infer<typeof ConnectorTier>;

export const Connector = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  kind: ConnectorKind,
  account: z.string().optional(),
  scopes: z.array(z.string()).default([]),
  tier: ConnectorTier,
  status: ConnectorStatus,
  secretRef: z.string().optional(),
  lastSync: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Connector = z.infer<typeof Connector>;

export const CreateConnectorRequest = z.object({
  kind: ConnectorKind,
  account: z.string().optional(),
  scopes: z.array(z.string()).default([]),
  tier: ConnectorTier.default(1),
  secretRef: z.string().min(1),
});
export type CreateConnectorRequest = z.infer<typeof CreateConnectorRequest>;

export const ConnectorActionRequest = z.object({
  tier: ConnectorTier.default(1),
  input: z.record(z.unknown()).default({}),
});
export type ConnectorActionRequest = z.infer<typeof ConnectorActionRequest>;

export const GitHubListReposInput = z.object({
  type: z.enum(['all', 'owner', 'member', 'public', 'private']).default('all'),
  perPage: z.number().int().min(1).max(100).default(30),
});
export type GitHubListReposInput = z.infer<typeof GitHubListReposInput>;

export const GitHubIssueInput = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  issueNumber: z.number().int().min(1),
});
export type GitHubIssueInput = z.infer<typeof GitHubIssueInput>;

export const GitHubPullRequestInput = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  pullNumber: z.number().int().min(1),
});
export type GitHubPullRequestInput = z.infer<typeof GitHubPullRequestInput>;

export const GitHubIngestFileInput = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  path: z.string().min(1),
  ref: z.string().optional(),
});
export type GitHubIngestFileInput = z.infer<typeof GitHubIngestFileInput>;

export const GitHubOpenPrInput = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  title: z.string().min(1),
  body: z.string().default(''),
  head: z.string().min(1),
  base: z.string().min(1),
});
export type GitHubOpenPrInput = z.infer<typeof GitHubOpenPrInput>;

// Telegram
export const TelegramChat = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.enum(['private', 'group', 'supergroup', 'channel']).optional(),
  title: z.string().optional(),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});
export type TelegramChat = z.infer<typeof TelegramChat>;

export const TelegramUser = z.object({
  id: z.number(),
  is_bot: z.boolean().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});
export type TelegramUser = z.infer<typeof TelegramUser>;

export const TelegramMessage = z.object({
  message_id: z.number(),
  from: TelegramUser.optional(),
  date: z.number(),
  chat: TelegramChat,
  text: z.string().optional(),
});
export type TelegramMessage = z.infer<typeof TelegramMessage>;

export const TelegramUpdate = z.object({
  update_id: z.number(),
  message: TelegramMessage.optional(),
  edited_message: TelegramMessage.optional(),
  channel_post: TelegramMessage.optional(),
  edited_channel_post: TelegramMessage.optional(),
});
export type TelegramUpdate = z.infer<typeof TelegramUpdate>;

export const TelegramGetChatInput = z.object({
  chatId: z.union([z.string().min(1), z.number()]),
});
export type TelegramGetChatInput = z.infer<typeof TelegramGetChatInput>;

export const TelegramSendMessageInput = z.object({
  chatId: z.union([z.string().min(1), z.number()]),
  text: z.string().min(1),
});
export type TelegramSendMessageInput = z.infer<typeof TelegramSendMessageInput>;

export const TelegramSetWebhookInput = z.object({
  url: z.string().url(),
  secretToken: z.string().min(1),
});
export type TelegramSetWebhookInput = z.infer<typeof TelegramSetWebhookInput>;

// WhatsApp (Meta Business)
export const WhatsAppGetBusinessProfileInput = z.object({
  phoneNumberId: z.string().min(1),
});
export type WhatsAppGetBusinessProfileInput = z.infer<typeof WhatsAppGetBusinessProfileInput>;

export const WhatsAppSendMessageInput = z.object({
  phoneNumberId: z.string().min(1),
  to: z.string().min(1),
  text: z.string().min(1),
});
export type WhatsAppSendMessageInput = z.infer<typeof WhatsAppSendMessageInput>;

// Instagram
export const InstagramListMediaInput = z.object({
  igUserId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(25),
});
export type InstagramListMediaInput = z.infer<typeof InstagramListMediaInput>;

export const InstagramGetMediaInput = z.object({
  mediaId: z.string().min(1),
});
export type InstagramGetMediaInput = z.infer<typeof InstagramGetMediaInput>;

export const InstagramPublishMediaInput = z.object({
  igUserId: z.string().min(1),
  imageUrl: z.string().url(),
  caption: z.string().default(''),
});
export type InstagramPublishMediaInput = z.infer<typeof InstagramPublishMediaInput>;

// Facebook
export const FacebookListPagesInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
});
export type FacebookListPagesInput = z.infer<typeof FacebookListPagesInput>;

export const FacebookListPostsInput = z.object({
  pageId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(25),
});
export type FacebookListPostsInput = z.infer<typeof FacebookListPostsInput>;

export const FacebookPublishPostInput = z.object({
  pageId: z.string().min(1),
  message: z.string().min(1),
  link: z.string().url().optional(),
});
export type FacebookPublishPostInput = z.infer<typeof FacebookPublishPostInput>;

// Pinterest
export const PinterestListBoardsInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
});
export type PinterestListBoardsInput = z.infer<typeof PinterestListBoardsInput>;

export const PinterestListPinsInput = z.object({
  boardId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(25),
});
export type PinterestListPinsInput = z.infer<typeof PinterestListPinsInput>;

export const PinterestCreatePinInput = z.object({
  boardId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  link: z.string().url().optional(),
  mediaSource: z.string().url(),
});
export type PinterestCreatePinInput = z.infer<typeof PinterestCreatePinInput>;

// Stripe
export const StripeListChargesInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
});
export type StripeListChargesInput = z.infer<typeof StripeListChargesInput>;

export const StripeListSubscriptionsInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  status: z.enum(['all', 'active', 'canceled', 'incomplete', 'past_due', 'unpaid']).default('all'),
});
export type StripeListSubscriptionsInput = z.infer<typeof StripeListSubscriptionsInput>;

export const StripeListPayoutsInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
});
export type StripeListPayoutsInput = z.infer<typeof StripeListPayoutsInput>;

// Lemon Squeezy
export const LemonSqueezyListOrdersInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
});
export type LemonSqueezyListOrdersInput = z.infer<typeof LemonSqueezyListOrdersInput>;

export const LemonSqueezyListSubscriptionsInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
});
export type LemonSqueezyListSubscriptionsInput = z.infer<typeof LemonSqueezyListSubscriptionsInput>;

// Paddle
export const PaddleListTransactionsInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  after: z.string().datetime().optional(),
});
export type PaddleListTransactionsInput = z.infer<typeof PaddleListTransactionsInput>;

export const PaddleListSubscriptionsInput = z.object({
  limit: z.number().int().min(1).max(100).default(25),
});
export type PaddleListSubscriptionsInput = z.infer<typeof PaddleListSubscriptionsInput>;

// Unified sales report
export const SalesReportPeriod = z.enum(['day', 'week', 'month', 'quarter', 'year']);
export type SalesReportPeriod = z.infer<typeof SalesReportPeriod>;

export const SalesReportInput = z.object({
  period: SalesReportPeriod.default('month'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type SalesReportInput = z.infer<typeof SalesReportInput>;

// Export connectors
export const CsvExportInput = z.object({
  reportType: z.literal('sales'),
  period: SalesReportPeriod.default('month'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type CsvExportInput = z.infer<typeof CsvExportInput>;

export const XlsxExportInput = CsvExportInput;
export type XlsxExportInput = z.infer<typeof XlsxExportInput>;

export const GoogleSheetsExportInput = z.object({
  reportType: z.literal('sales'),
  spreadsheetId: z.string().min(1),
  range: z.string().default('Sheet1!A1'),
  period: SalesReportPeriod.default('month'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type GoogleSheetsExportInput = z.infer<typeof GoogleSheetsExportInput>;

// Gmail
export const GmailListMessagesInput = z.object({
  maxResults: z.number().int().min(1).max(100).default(25),
  query: z.string().default(''),
});
export type GmailListMessagesInput = z.infer<typeof GmailListMessagesInput>;

export const GmailGetMessageInput = z.object({
  id: z.string().min(1),
});
export type GmailGetMessageInput = z.infer<typeof GmailGetMessageInput>;

export const GmailSendMessageInput = z.object({
  to: z.string().min(1),
  subject: z.string().default(''),
  body: z.string().min(1),
});
export type GmailSendMessageInput = z.infer<typeof GmailSendMessageInput>;

// Microsoft Graph (Outlook)
export const MicrosoftGraphListMessagesInput = z.object({
  top: z.number().int().min(1).max(100).default(25),
  filter: z.string().optional(),
});
export type MicrosoftGraphListMessagesInput = z.infer<typeof MicrosoftGraphListMessagesInput>;

export const MicrosoftGraphGetMessageInput = z.object({
  id: z.string().min(1),
});
export type MicrosoftGraphGetMessageInput = z.infer<typeof MicrosoftGraphGetMessageInput>;

export const MicrosoftGraphSendMessageInput = z.object({
  to: z.string().min(1),
  subject: z.string().default(''),
  body: z.string().min(1),
});
export type MicrosoftGraphSendMessageInput = z.infer<typeof MicrosoftGraphSendMessageInput>;

// Airtable
export const AirtableListBasesInput = z.object({
  offset: z.string().optional(),
});
export type AirtableListBasesInput = z.infer<typeof AirtableListBasesInput>;

export const AirtableListRecordsInput = z.object({
  baseId: z.string().min(1),
  tableId: z.string().min(1),
  maxRecords: z.number().int().min(1).max(100).default(25),
  offset: z.string().optional(),
});
export type AirtableListRecordsInput = z.infer<typeof AirtableListRecordsInput>;

export const AirtableGetRecordInput = z.object({
  baseId: z.string().min(1),
  tableId: z.string().min(1),
  recordId: z.string().min(1),
});
export type AirtableGetRecordInput = z.infer<typeof AirtableGetRecordInput>;

export const AirtableCreateRecordInput = z.object({
  baseId: z.string().min(1),
  tableId: z.string().min(1),
  fields: z.record(z.unknown()),
});
export type AirtableCreateRecordInput = z.infer<typeof AirtableCreateRecordInput>;

export const AirtableUpdateRecordInput = z.object({
  baseId: z.string().min(1),
  tableId: z.string().min(1),
  recordId: z.string().min(1),
  fields: z.record(z.unknown()),
});
export type AirtableUpdateRecordInput = z.infer<typeof AirtableUpdateRecordInput>;

// Google Contacts
export const GoogleContactsListContactsInput = z.object({
  pageSize: z.number().int().min(1).max(100).default(25),
  pageToken: z.string().optional(),
});
export type GoogleContactsListContactsInput = z.infer<typeof GoogleContactsListContactsInput>;

export const GoogleContactsGetContactInput = z.object({
  resourceName: z.string().min(1),
});
export type GoogleContactsGetContactInput = z.infer<typeof GoogleContactsGetContactInput>;

export const GoogleContactsCreateContactInput = z.object({
  givenName: z.string().min(1),
  familyName: z.string().optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
});
export type GoogleContactsCreateContactInput = z.infer<typeof GoogleContactsCreateContactInput>;

// Google Docs
export const GoogleDocsGetDocumentInput = z.object({
  documentId: z.string().min(1),
});
export type GoogleDocsGetDocumentInput = z.infer<typeof GoogleDocsGetDocumentInput>;

export const GoogleDocsCreateDocumentInput = z.object({
  title: z.string().min(1),
});
export type GoogleDocsCreateDocumentInput = z.infer<typeof GoogleDocsCreateDocumentInput>;

// Discord
export const DiscordUser = z.object({
  id: z.string(),
  username: z.string().optional(),
  global_name: z.string().nullable().optional(),
  bot: z.boolean().optional(),
});
export type DiscordUser = z.infer<typeof DiscordUser>;

export const DiscordMessage = z.object({
  id: z.string(),
  channel_id: z.string(),
  author: DiscordUser,
  content: z.string(),
  timestamp: z.string().datetime().optional(),
});
export type DiscordMessage = z.infer<typeof DiscordMessage>;

export const DiscordInteraction = z.object({
  id: z.string(),
  application_id: z.string(),
  type: z.number(),
  token: z.string(),
  user: DiscordUser.optional(),
  member: z
    .object({
      user: DiscordUser.optional(),
    })
    .optional(),
  data: z.record(z.unknown()).optional(),
  channel: z.object({ id: z.string() }).optional(),
});
export type DiscordInteraction = z.infer<typeof DiscordInteraction>;

export const DiscordUpdate = z.object({
  id: z.string().optional(),
  application_id: z.string().optional(),
  type: z.number().optional(),
  token: z.string().optional(),
  user: DiscordUser.optional(),
  member: z
    .object({
      user: DiscordUser.optional(),
    })
    .optional(),
  data: z.record(z.unknown()).optional(),
  channel: z.object({ id: z.string() }).optional(),
  message: DiscordMessage.optional(),
  t: z.string().optional(),
  s: z.number().optional(),
  op: z.number().optional(),
  d: z.record(z.unknown()).optional(),
});
export type DiscordUpdate = z.infer<typeof DiscordUpdate>;

export const DiscordListChannelsInput = z.object({
  guildId: z.string().min(1),
});
export type DiscordListChannelsInput = z.infer<typeof DiscordListChannelsInput>;

export const DiscordGetMessagesInput = z.object({
  channelId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(25),
  before: z.string().optional(),
});
export type DiscordGetMessagesInput = z.infer<typeof DiscordGetMessagesInput>;

export const DiscordSendMessageInput = z.object({
  channelId: z.string().min(1),
  content: z.string().min(1),
});
export type DiscordSendMessageInput = z.infer<typeof DiscordSendMessageInput>;

export const DiscordSetWebhookInput = z.object({
  url: z.string().url(),
});
export type DiscordSetWebhookInput = z.infer<typeof DiscordSetWebhookInput>;

// Notion
export const NotionSearchInput = z.object({
  query: z.string().optional(),
  pageSize: z.number().int().min(1).max(100).default(10),
});
export type NotionSearchInput = z.infer<typeof NotionSearchInput>;

export const NotionPageInput = z.object({
  pageId: z.string().min(1),
});
export type NotionPageInput = z.infer<typeof NotionPageInput>;

export const NotionDatabaseInput = z.object({
  databaseId: z.string().min(1),
});
export type NotionDatabaseInput = z.infer<typeof NotionDatabaseInput>;

export const NotionQueryDatabaseInput = z.object({
  databaseId: z.string().min(1),
  pageSize: z.number().int().min(1).max(100).default(10),
});
export type NotionQueryDatabaseInput = z.infer<typeof NotionQueryDatabaseInput>;

export const NotionAppendBlocksInput = z.object({
  blockId: z.string().min(1),
  children: z.array(z.record(z.unknown())).min(1).max(100),
});
export type NotionAppendBlocksInput = z.infer<typeof NotionAppendBlocksInput>;

// Slack
export const SlackUser = z.object({
  id: z.string(),
  username: z.string().optional(),
  name: z.string().optional(),
});
export type SlackUser = z.infer<typeof SlackUser>;

export const SlackMessageEvent = z.object({
  type: z.string(),
  user: z.string().optional(),
  channel: z.string().optional(),
  text: z.string().optional(),
  ts: z.string().optional(),
  thread_ts: z.string().optional(),
  bot_id: z.string().optional(),
  subtype: z.string().optional(),
});
export type SlackMessageEvent = z.infer<typeof SlackMessageEvent>;

export const SlackEventCallback = z.object({
  type: z.literal('event_callback'),
  token: z.string(),
  team_id: z.string(),
  api_app_id: z.string(),
  event_id: z.string(),
  event_time: z.number().optional(),
  event: SlackMessageEvent,
  authorizations: z.array(z.record(z.unknown())).optional(),
});
export type SlackEventCallback = z.infer<typeof SlackEventCallback>;

export const SlackUrlVerification = z.object({
  type: z.literal('url_verification'),
  token: z.string(),
  challenge: z.string(),
});
export type SlackUrlVerification = z.infer<typeof SlackUrlVerification>;

export const SlackWebhookBody = z.union([SlackUrlVerification, SlackEventCallback]);
export type SlackWebhookBody = z.infer<typeof SlackWebhookBody>;

export const SlackListChannelsInput = z.object({
  types: z.string().default('public_channel'),
  limit: z.number().int().min(1).max(200).default(100),
});
export type SlackListChannelsInput = z.infer<typeof SlackListChannelsInput>;

export const SlackGetMessagesInput = z.object({
  channelId: z.string().min(1),
  limit: z.number().int().min(1).max(200).default(100),
});
export type SlackGetMessagesInput = z.infer<typeof SlackGetMessagesInput>;

export const SlackSendMessageInput = z.object({
  channelId: z.string().min(1),
  text: z.string().min(1),
  threadTs: z.string().optional(),
});
export type SlackSendMessageInput = z.infer<typeof SlackSendMessageInput>;
