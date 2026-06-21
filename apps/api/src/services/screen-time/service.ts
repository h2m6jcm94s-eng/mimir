import type { TenantContext } from '../../db/tenant-context';
import {
  type CreateScreenTimeEntryInput,
  type ListScreenTimeOptions,
  createScreenTimeEntry as createEntry,
  deleteScreenTimeEntry as deleteEntry,
  getScreenTimeSummary as fetchSummary,
  getScreenTimeEntryById,
  listScreenTimeEntries as listEntries,
} from '../../repositories/screen-time';

export type { CreateScreenTimeEntryInput, ListScreenTimeOptions };

export async function createScreenTimeEntry(ctx: TenantContext, input: CreateScreenTimeEntryInput) {
  return createEntry(ctx, input);
}

export async function listScreenTimeEntries(ctx: TenantContext, options: ListScreenTimeOptions) {
  return listEntries(ctx, options);
}

export async function getScreenTimeSummary(ctx: TenantContext, options: ListScreenTimeOptions) {
  return fetchSummary(ctx, options);
}

export async function deleteScreenTimeEntry(ctx: TenantContext, id: string) {
  const existing = await getScreenTimeEntryById(ctx, id);
  if (!existing) {
    const error = new Error('Screen-time entry not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }
  await deleteEntry(ctx, id);
  return { deleted: true };
}
