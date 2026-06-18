import { z } from 'zod';

export const MarketingCampaignStatus = z.enum(['draft', 'active', 'completed', 'archived']);
export type MarketingCampaignStatus = z.infer<typeof MarketingCampaignStatus>;

export const MarketingCalendarStatus = z.enum(['draft', 'scheduled', 'published']);
export type MarketingCalendarStatus = z.infer<typeof MarketingCalendarStatus>;

export const MarketingPlatform = z.enum([
  'blog',
  'twitter',
  'linkedin',
  'instagram',
  'facebook',
  'email',
  'ad',
]);
export type MarketingPlatform = z.infer<typeof MarketingPlatform>;

export const CampaignMetrics = z.object({
  impressions: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  conversions: z.number().int().min(0).default(0),
});
export type CampaignMetrics = z.infer<typeof CampaignMetrics>;

export const BrandVoice = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  tone: z.string(),
  audience: z.string(),
  guidelines: z.string(),
  sampleText: z.string(),
  isDefault: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BrandVoice = z.infer<typeof BrandVoice>;

export const Campaign = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  brandVoiceId: z.string().uuid().nullable(),
  name: z.string(),
  goal: z.string(),
  status: MarketingCampaignStatus,
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  budget: z.number().int().nullable(),
  metrics: CampaignMetrics,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Campaign = z.infer<typeof Campaign>;

export const ContentCalendarItem = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  campaignId: z.string().uuid().nullable(),
  title: z.string(),
  body: z.string(),
  platform: MarketingPlatform,
  scheduledAt: z.string().datetime().nullable(),
  status: MarketingCalendarStatus,
  tier: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ContentCalendarItem = z.infer<typeof ContentCalendarItem>;

export const CreateBrandVoiceRequest = z.object({
  name: z.string().min(1).max(120),
  tone: z.string().max(500).default(''),
  audience: z.string().max(500).default(''),
  guidelines: z.string().max(2000).default(''),
  sampleText: z.string().max(2000).default(''),
  isDefault: z.boolean().default(false),
});
export type CreateBrandVoiceRequest = z.infer<typeof CreateBrandVoiceRequest>;

export const UpdateBrandVoiceRequest = CreateBrandVoiceRequest.partial();
export type UpdateBrandVoiceRequest = z.infer<typeof UpdateBrandVoiceRequest>;

export const CreateCampaignRequest = z.object({
  brandVoiceId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  goal: z.string().max(1000).default(''),
  status: MarketingCampaignStatus.default('draft'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budget: z.number().int().min(0).optional(),
  metrics: CampaignMetrics.default({}),
});
export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequest>;

export const UpdateCampaignRequest = CreateCampaignRequest.partial();
export type UpdateCampaignRequest = z.infer<typeof UpdateCampaignRequest>;

export const CreateContentCalendarItemRequest = z.object({
  campaignId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  body: z.string().max(5000).default(''),
  platform: MarketingPlatform,
  scheduledAt: z.string().datetime().optional(),
  status: MarketingCalendarStatus.default('draft'),
  tier: z.number().int().min(0).max(2).default(1),
});
export type CreateContentCalendarItemRequest = z.infer<typeof CreateContentCalendarItemRequest>;

export const UpdateContentCalendarItemRequest = CreateContentCalendarItemRequest.partial();
export type UpdateContentCalendarItemRequest = z.infer<typeof UpdateContentCalendarItemRequest>;

export const ListCampaignsQuery = z.object({
  status: MarketingCampaignStatus.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListCampaignsQuery = z.infer<typeof ListCampaignsQuery>;

export const ListCalendarQuery = z.object({
  campaignId: z.string().uuid().optional(),
  status: MarketingCalendarStatus.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type ListCalendarQuery = z.infer<typeof ListCalendarQuery>;

export const MarketingAnalytics = z.object({
  campaigns: z.object({
    total: z.number().int(),
    active: z.number().int(),
    completed: z.number().int(),
  }),
  calendar: z.object({
    total: z.number().int(),
    scheduled: z.number().int(),
    published: z.number().int(),
  }),
  totals: CampaignMetrics,
});
export type MarketingAnalytics = z.infer<typeof MarketingAnalytics>;
