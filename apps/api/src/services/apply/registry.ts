import type { TenantContext } from '../../db/tenant-context';

export interface ApplyResult {
  applied: boolean;
  reason: string;
  output: Record<string, unknown>;
}

export interface ApplyDraft {
  success: boolean;
  artifacts: Record<string, unknown>;
  log: string[];
}

export interface ApplyReview {
  approved: boolean;
  [key: string]: unknown;
}

export interface ApplyInput {
  tenantId: string;
  userId: string;
  jobId: string;
  idempotencyKey: string;
  type: string;
  tier: number;
  payload: Record<string, unknown>;
}

export type ApplyHandler = (
  ctx: TenantContext,
  input: ApplyInput,
  draft: ApplyDraft,
  review: ApplyReview
) => ApplyResult | Promise<ApplyResult>;

export class ApplyRegistry {
  private handlers = new Map<string, ApplyHandler>();

  constructor() {
    this.register('default', defaultHandler);
    this.register('console-output', consoleOutputHandler);
  }

  register(type: string, handler: ApplyHandler): void {
    this.handlers.set(type, handler);
  }

  async handle(
    ctx: TenantContext,
    type: string,
    input: ApplyInput,
    draft: ApplyDraft,
    review: ApplyReview
  ): Promise<ApplyResult> {
    const handler = this.handlers.get(type) ?? this.handlers.get('default');
    if (!handler) {
      throw new Error('No default apply handler registered');
    }
    return handler(ctx, input, draft, review);
  }
}

export function defaultHandler(
  _ctx: TenantContext,
  _input: ApplyInput,
  draft: ApplyDraft,
  review: ApplyReview
): ApplyResult {
  return {
    applied: review.approved,
    reason: 'idempotently recorded',
    output: draft.artifacts,
  };
}

export function consoleOutputHandler(
  _ctx: TenantContext,
  _input: ApplyInput,
  draft: ApplyDraft,
  review: ApplyReview
): ApplyResult {
  return {
    applied: review.approved,
    reason: 'idempotently recorded (console-output)',
    output: { type: 'console-output', artifacts: draft.artifacts },
  };
}
