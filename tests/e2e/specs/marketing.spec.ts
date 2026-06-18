import { signInAsTestUser } from '../fixtures/auth';
import { expect, test } from '../fixtures/base';

test.describe('Marketing assistant', () => {
  test.beforeEach(async ({ page, context }) => {
    await signInAsTestUser(context);
    await page.goto('/marketing');
    await expect(page.getByTestId('marketing-analytics')).toBeVisible();
  });

  test('page loads with analytics, tabs and empty brand voices', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Marketing', level: 2 })).toBeVisible();
    await expect(page.getByTestId('marketing-analytics')).toBeVisible();
    await expect(page.getByTestId('marketing-tab-voices')).toBeVisible();
    await expect(page.getByTestId('marketing-tab-campaigns')).toBeVisible();
    await expect(page.getByTestId('marketing-tab-calendar')).toBeVisible();
    await expect(page.getByText('No brand voices yet.')).toBeVisible();
  });

  test('creates a brand voice, campaign, calendar item and generates a draft', async ({ page }) => {
    const voiceName = `Agency Voice ${Date.now()}`;
    await page.getByTestId('marketing-voice-name').fill(voiceName);
    await page.getByTestId('marketing-voice-tone').fill('playful professional');
    await page.getByTestId('marketing-voice-audience').fill('SaaS agency founders');
    await page.getByTestId('marketing-voice-guidelines').fill('Short sentences. No jargon.');
    await page.getByTestId('marketing-voice-sample').fill('Grow without the chaos.');
    await page.getByTestId('marketing-voice-default').check();
    await page.getByTestId('marketing-add-voice').click();

    await expect(page.getByTestId(`marketing-voice-${voiceName}`)).toBeVisible();
    await expect(page.getByText('Short sentences. No jargon.')).toBeVisible();

    await page.getByTestId('marketing-tab-campaigns').click();
    const campaignName = `Summer Launch ${Date.now()}`;
    await page.getByTestId('marketing-campaign-name').fill(campaignName);
    await page.getByTestId('marketing-campaign-status').selectOption('active');
    await page.getByTestId('marketing-campaign-budget').fill('5000');
    await page.getByTestId('marketing-campaign-goal').fill('Drive trial signups.');
    await page.getByTestId('marketing-add-campaign').click();

    await expect(page.getByTestId(`marketing-campaign-${campaignName}`)).toBeVisible();
    await expect(page.getByText('Drive trial signups.')).toBeVisible();
    await expect(page.getByText('active').first()).toBeVisible();

    await page.getByTestId('marketing-tab-calendar').click();
    const itemTitle = `Why agencies need a brain ${Date.now()}`;
    await page.getByTestId('marketing-calendar-title').fill(itemTitle);
    await page.getByTestId('marketing-calendar-platform').selectOption('twitter');
    await page.getByTestId('marketing-calendar-campaign').selectOption(campaignName);
    await page.getByTestId('marketing-calendar-status').selectOption('scheduled');
    await page.getByTestId('marketing-calendar-scheduled').fill('2030-07-15T09:00');
    await page.getByTestId('marketing-add-calendar').click();

    await expect(page.getByTestId(`marketing-calendar-${itemTitle}`)).toBeVisible();

    const item = page.getByTestId(`marketing-calendar-${itemTitle}`);
    await item.getByRole('button', { name: 'Draft' }).click();
    await expect(item.getByText(itemTitle)).toHaveCount(1);
    await expect(item.getByText('playful professional')).toBeVisible();
  });
});
