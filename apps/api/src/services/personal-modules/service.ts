import type { TenantContext } from '../../db/tenant-context';
import {
  type CreatePersonalModuleInput,
  type ListPersonalModulesOptions,
  type PersonalModuleRow,
  type UpdatePersonalModuleInput,
  createPersonalModule as createRepo,
  deletePersonalModule as deleteRepo,
  getPersonalModuleById,
  listPersonalModules as listRepo,
  updatePersonalModule as updateRepo,
} from '../../repositories/personal-modules';

export function createPersonalModule(
  ctx: TenantContext,
  input: CreatePersonalModuleInput
): Promise<PersonalModuleRow> {
  return createRepo(ctx, input);
}

export function listPersonalModules(
  ctx: TenantContext,
  options: ListPersonalModulesOptions
): Promise<PersonalModuleRow[]> {
  return listRepo(ctx, options);
}

export async function updatePersonalModule(
  ctx: TenantContext,
  id: string,
  input: UpdatePersonalModuleInput
): Promise<PersonalModuleRow> {
  const row = await updateRepo(ctx, id, input);
  if (!row) {
    const error = new Error('Personal module not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }
  return row;
}

export async function deletePersonalModule(
  ctx: TenantContext,
  id: string
): Promise<PersonalModuleRow> {
  const row = await deleteRepo(ctx, id);
  if (!row) {
    const error = new Error('Personal module not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }
  return row;
}

export async function markPersonalModuleDone(
  ctx: TenantContext,
  id: string
): Promise<PersonalModuleRow> {
  const existing = await getPersonalModuleById(ctx, id);
  if (!existing) {
    const error = new Error('Personal module not found');
    (error as { statusCode?: number }).statusCode = 404;
    throw error;
  }
  return updatePersonalModule(ctx, id, { status: 'done' });
}
