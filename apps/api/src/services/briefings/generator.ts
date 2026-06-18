import type { TenantContext } from '../../db/tenant-context';
import { createBriefing } from '../../repositories/briefing';
import { countJobsByStatus, listJobs } from '../../repositories/job';
import { listKnowledgeItems } from '../../repositories/knowledge';
import { listNotifications } from '../../repositories/notification';

export async function generateBriefings(ctx: TenantContext) {
  const now = new Date();
  const counts = await countJobsByStatus(ctx);
  const recentJobs = await listJobs(ctx, { limit: 5 });
  const recentKnowledge = await listKnowledgeItems(ctx, { limit: 5 });
  const recentNotifications = await listNotifications(ctx, 5);

  const items = [];

  items.push(
    await createBriefing(ctx, {
      kind: 'briefing',
      title: 'Daily Task Brief',
      summary: `Queue: ${counts.queued ?? 0} queued, ${counts.running ?? 0} running, ${counts.done ?? 0} done, ${counts.failed ?? 0} failed.`,
      tier: 0,
      confidence: 0.95,
      sources: recentJobs.data.length,
      payload: { counts },
      pinned: 'pinned',
    })
  );

  if (recentKnowledge.length > 0) {
    items.push(
      await createBriefing(ctx, {
        kind: 'briefing',
        title: 'Knowledge Snapshot',
        summary: `${recentKnowledge.length} recent knowledge items captured, including ${recentKnowledge[0].kind}.`,
        tier: recentKnowledge[0].tier,
        confidence: 0.88,
        sources: recentKnowledge.length,
      })
    );
  }

  if (recentNotifications.length > 0) {
    items.push(
      await createBriefing(ctx, {
        kind: 'email',
        title: `Notification: ${recentNotifications[0].title}`,
        summary: recentNotifications[0].body,
        tier: 1,
        confidence: 0.92,
        payload: { notificationId: recentNotifications[0].id },
      })
    );
  }

  items.push(
    await createBriefing(ctx, {
      kind: 'meeting',
      title: 'Daily Stand-up',
      summary: 'Review active jobs, blockers, and cost burn.',
      tier: 1,
      confidence: 0.9,
      sources: 1,
      payload: { attendees: 1, duration: '15 min' },
    })
  );

  return { generatedAt: now.toISOString(), items };
}
