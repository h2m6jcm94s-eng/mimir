import type { TenantContext } from '../../db/tenant-context';
import {
  type CreateLifeAdminInput,
  type LifeAdminListOptions,
  type LifeAdminRow,
  createLifeAdminItem,
  getLifeAdminItemById,
  listLifeAdminItems,
  markLifeAdminDone,
} from '../../repositories/life-admin';

function computeNextDueDate(dueDate: string, recurrence: LifeAdminRow['recurrence']): string {
  const date = new Date(dueDate);
  switch (recurrence) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      return dueDate;
  }
  return date.toISOString();
}

export async function createLifeAdmin(
  ctx: TenantContext,
  input: CreateLifeAdminInput
): Promise<LifeAdminRow> {
  return createLifeAdminItem(ctx, input);
}

export async function listLifeAdmin(
  ctx: TenantContext,
  options: LifeAdminListOptions
): Promise<LifeAdminRow[]> {
  return listLifeAdminItems(ctx, options);
}

export async function completeLifeAdmin(
  ctx: TenantContext,
  id: string
): Promise<{ completed: LifeAdminRow; next?: LifeAdminRow }> {
  const item = await getLifeAdminItemById(ctx, id);
  if (!item) {
    const error = new Error('Life admin item not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }

  const completed = await markLifeAdminDone(ctx, id);
  if (!completed) {
    const error = new Error('Life admin item not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }

  if (item.recurrence && item.recurrence !== 'none') {
    const nextDueDate = computeNextDueDate(item.dueDate.toISOString(), item.recurrence);
    const next = await createLifeAdmin(ctx, {
      title: item.title,
      description: item.description,
      dueDate: nextDueDate,
      recurrence: item.recurrence,
      category: item.category ?? undefined,
      tags: item.tags,
      tier: item.tier,
    });
    return { completed, next };
  }

  return { completed };
}
