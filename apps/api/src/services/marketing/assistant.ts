import type { TenantContext } from '../../db/tenant-context';
import * as repo from '../../repositories/marketing';

export async function createBrandVoice(ctx: TenantContext, input: repo.CreateBrandVoiceInput) {
  return repo.createBrandVoice(ctx, input);
}

export async function listBrandVoices(ctx: TenantContext, limit = 50) {
  return repo.listBrandVoices(ctx, limit);
}

export async function getBrandVoice(ctx: TenantContext, id: string) {
  return repo.getBrandVoiceById(ctx, id);
}

export async function updateBrandVoice(
  ctx: TenantContext,
  id: string,
  input: repo.UpdateBrandVoiceInput
) {
  return repo.updateBrandVoice(ctx, id, input);
}

export async function deleteBrandVoice(ctx: TenantContext, id: string) {
  return repo.deleteBrandVoice(ctx, id);
}

export async function createCampaign(ctx: TenantContext, input: repo.CreateCampaignInput) {
  return repo.createCampaign(ctx, input);
}

export async function listCampaigns(
  ctx: TenantContext,
  options: { status?: string; limit: number }
) {
  return repo.listCampaigns(ctx, options);
}

export async function getCampaign(ctx: TenantContext, id: string) {
  return repo.getCampaignById(ctx, id);
}

export async function updateCampaign(
  ctx: TenantContext,
  id: string,
  input: repo.UpdateCampaignInput
) {
  return repo.updateCampaign(ctx, id, input);
}

export async function deleteCampaign(ctx: TenantContext, id: string) {
  return repo.deleteCampaign(ctx, id);
}

export async function createCalendarItem(ctx: TenantContext, input: repo.CreateCalendarItemInput) {
  return repo.createCalendarItem(ctx, input);
}

export async function listCalendarItems(ctx: TenantContext, options: repo.ListCalendarOptions) {
  return repo.listCalendarItems(ctx, options);
}

export async function getCalendarItem(ctx: TenantContext, id: string) {
  return repo.getCalendarItemById(ctx, id);
}

export async function updateCalendarItem(
  ctx: TenantContext,
  id: string,
  input: repo.UpdateCalendarItemInput
) {
  return repo.updateCalendarItem(ctx, id, input);
}

export async function deleteCalendarItem(ctx: TenantContext, id: string) {
  return repo.deleteCalendarItem(ctx, id);
}

export async function getAnalytics(ctx: TenantContext) {
  return repo.getMarketingAnalytics(ctx);
}

export interface DraftInput {
  campaignId?: string;
  platform: string;
  topic: string;
}

export async function generateDraft(ctx: TenantContext, input: DraftInput): Promise<string> {
  let voice = await repo.getDefaultBrandVoice(ctx);
  if (input.campaignId) {
    const campaign = await repo.getCampaignById(ctx, input.campaignId);
    if (campaign?.brandVoiceId) {
      const campaignVoice = await repo.getBrandVoiceById(ctx, campaign.brandVoiceId);
      if (campaignVoice) voice = campaignVoice;
    }
  }

  const tone = voice?.tone?.trim() || 'professional';
  const audience = voice?.audience?.trim() || 'our audience';
  const guidelines = voice?.guidelines?.trim() || 'keep it clear and concise';

  const platformHint: Record<string, string> = {
    twitter: 'short, punchy, under 280 characters',
    linkedin: 'professional and thoughtful',
    instagram: 'visual and engaging with emojis',
    facebook: 'friendly and conversational',
    blog: 'detailed and educational',
    email: 'direct with a clear call to action',
    ad: 'attention-grabbing and conversion-focused',
  };

  return [
    `Draft for ${input.platform}${input.campaignId ? ' campaign' : ''}: ${input.topic}`,
    '',
    `Tone: ${tone}. Audience: ${audience}.`,
    `Guidelines: ${guidelines}.`,
    `Format: ${platformHint[input.platform] || 'adapted to the channel'}.`,
    '',
    'Write the full draft here and schedule when ready.',
  ].join('\n');
}
