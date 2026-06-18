interface RuntimeToolField {
  name: string;
  type: string;
  required?: boolean;
}

interface RuntimeTool {
  enabled: boolean;
  status: string;
  action: string;
  fields: RuntimeToolField[];
}
import type { TenantContext } from '../../db/tenant-context';
import { connectorRegistry } from '../connectors/registry';

export class ToolEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolEngineError';
  }
}

function validateField(field: RuntimeToolField, value: unknown): void {
  if (field.required && (value === undefined || value === null || value === '')) {
    throw new ToolEngineError(`Missing required field: ${field.name}`);
  }
  if (value === undefined || value === null) return;

  switch (field.type) {
    case 'string':
      if (typeof value !== 'string') {
        throw new ToolEngineError(`Field ${field.name} must be a string`);
      }
      break;
    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new ToolEngineError(`Field ${field.name} must be a number`);
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new ToolEngineError(`Field ${field.name} must be a boolean`);
      }
      break;
  }
}

export async function runTool(
  ctx: TenantContext,
  tool: RuntimeTool,
  input: Record<string, unknown>,
  actor: string,
  requestTier = 1
): Promise<Record<string, unknown>> {
  if (!tool.enabled) {
    throw new ToolEngineError('Tool is disabled');
  }
  if (tool.status !== 'active') {
    throw new ToolEngineError(`Tool is ${tool.status}`);
  }

  for (const field of tool.fields) {
    validateField(field, input[field.name]);
  }

  const actionParts = tool.action.split('.');
  if (actionParts.length !== 2 || !actionParts[0] || !actionParts[1]) {
    throw new ToolEngineError(`Invalid tool action: ${tool.action}`);
  }
  const [kind, action] = actionParts;

  const result = await connectorRegistry.runAction(ctx, {
    tenantId: ctx.tenantId,
    kind,
    action,
    input,
    requestTier,
    actor,
  });

  return result.result;
}
