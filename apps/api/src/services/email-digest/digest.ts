import type {
  EmailDigestContent,
  SendDigestResult as SendDigestResultType,
} from '@mimir/shared-types';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import * as schema from '../../db/schema';
import type { TenantContext } from '../../db/tenant-context';
import { listPendingApprovals } from '../../repositories/approval';
import {
  type UpsertEmailDigestPreferenceInput,
  getEmailDigestPreference,
  markEmailDigestSent,
  upsertEmailDigestPreference,
} from '../../repositories/email-digest';
import { listJobs } from '../../repositories/job';
import { listNotifications } from '../../repositories/notification';
import { listReports } from '../../repositories/report';
import { sendEmail } from './transport';

export type { UpsertEmailDigestPreferenceInput };

export async function getOrCreateEmailDigestPreference(ctx: TenantContext, appUserId: string) {
  const existing = await getEmailDigestPreference(ctx, appUserId);
  if (existing) return existing;
  return upsertEmailDigestPreference(ctx, {
    appUserId,
    frequency: 'daily',
    enabled: true,
    includeNotifications: true,
    includeTasks: true,
    includeApprovals: true,
    includeReports: true,
  });
}

export async function updateEmailDigestPreference(
  ctx: TenantContext,
  appUserId: string,
  input: UpsertEmailDigestPreferenceInput
) {
  return upsertEmailDigestPreference(ctx, { ...input, appUserId });
}

async function getUserEmail(ctx: TenantContext, appUserId: string): Promise<string | undefined> {
  const [membership] = await ctx.tenantScopedDb
    .select({ userAccountId: schema.appUser.userAccountId })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, appUserId));
  if (!membership) return undefined;

  const [account] = await db
    .select({ email: schema.userAccount.email })
    .from(schema.userAccount)
    .where(eq(schema.userAccount.id, membership.userAccountId));
  return account?.email;
}

function digestWindowStart(frequency: 'daily' | 'weekly', now: Date): Date {
  const ms = frequency === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms);
}

export async function generateDigestContent(
  ctx: TenantContext,
  _appUserId: string,
  preference: {
    frequency: 'daily' | 'weekly';
    includeNotifications: boolean;
    includeTasks: boolean;
    includeApprovals: boolean;
    includeReports: boolean;
  },
  now = new Date()
): Promise<EmailDigestContent> {
  const since = digestWindowStart(preference.frequency, now);

  const [notifications, jobs, approvals, reports] = await Promise.all([
    preference.includeNotifications
      ? listNotifications(ctx, 25).then((rows) =>
          rows.filter((n) => new Date(n.createdAt) >= since)
        )
      : Promise.resolve([]),
    preference.includeTasks
      ? listJobs(ctx, { limit: 25 }).then((result) =>
          result.data.filter((j) => new Date(j.createdAt) >= since)
        )
      : Promise.resolve([]),
    preference.includeApprovals
      ? listPendingApprovals(ctx).then((rows) => rows.filter((a) => new Date(a.createdAt) >= since))
      : Promise.resolve([]),
    preference.includeReports
      ? listReports(ctx, 25).then((rows) => rows.filter((r) => new Date(r.createdAt) >= since))
      : Promise.resolve([]),
  ]);

  return {
    notifications: notifications.map((n) => ({
      title: n.title,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
    tasks: jobs.map((j) => ({
      id: j.id,
      type: j.type,
      status: j.status,
      createdAt: j.createdAt.toISOString(),
    })),
    approvals: approvals.map((a) => ({
      id: a.id,
      status: a.status,
      risk: a.risk,
      createdAt: a.createdAt.toISOString(),
    })),
    reports: reports.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

function formatEmailBody(
  content: EmailDigestContent,
  frequency: string
): { text: string; html: string } {
  const sections: string[] = [];
  const htmlSections: string[] = [];

  const addSection = (title: string, items: { text: string; html: string }[]) => {
    if (items.length === 0) return;
    sections.push(`## ${title}\n`);
    htmlSections.push(`<h2>${title}</h2><ul>`);
    for (const item of items) {
      sections.push(`- ${item.text}`);
      htmlSections.push(`<li>${item.html}</li>`);
    }
    htmlSections.push('</ul>');
  };

  addSection(
    'Notifications',
    content.notifications.map((n) => ({
      text: `${n.title}: ${n.body}`,
      html: `<b>${n.title}</b>: ${n.body}`,
    }))
  );
  addSection(
    'Tasks',
    content.tasks.map((t) => ({
      text: `${t.type} — ${t.status}`,
      html: `${t.type} — <i>${t.status}</i>`,
    }))
  );
  addSection(
    'Approvals',
    content.approvals.map((a) => ({
      text: `${a.id} — ${a.status} (${a.risk})`,
      html: `${a.id} — ${a.status} (${a.risk})`,
    }))
  );
  addSection(
    'Reports',
    content.reports.map((r) => ({
      text: `${r.title} — ${r.status}`,
      html: `<b>${r.title}</b> — ${r.status}`,
    }))
  );

  const text =
    sections.length > 0
      ? [`Your ${frequency} Mimir digest`, '', ...sections].join('\n')
      : `Your ${frequency} Mimir digest is empty — nothing to report.`;

  const html = `<html><body><h1>Your ${frequency} Mimir digest</h1>${htmlSections.length > 0 ? htmlSections.join('') : '<p>Nothing to report.</p>'}</body></html>`;

  return { text, html };
}

export async function sendEmailDigest(
  ctx: TenantContext,
  appUserId: string,
  preference: {
    id: string;
    frequency: 'daily' | 'weekly';
    includeNotifications: boolean;
    includeTasks: boolean;
    includeApprovals: boolean;
    includeReports: boolean;
  },
  now = new Date()
): Promise<SendDigestResultType> {
  const recipient = await getUserEmail(ctx, appUserId);
  if (!recipient) {
    return { sent: false, error: 'User email not found' };
  }

  const content = await generateDigestContent(ctx, appUserId, preference, now);
  const { text, html } = formatEmailBody(content, preference.frequency);
  const subject =
    preference.frequency === 'daily' ? 'Your daily Mimir digest' : 'Your weekly Mimir digest';

  try {
    await sendEmail({ to: recipient, subject, text, html });
    await markEmailDigestSent(ctx, preference.id);
    return { sent: true, recipient };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { sent: false, recipient, error };
  }
}
