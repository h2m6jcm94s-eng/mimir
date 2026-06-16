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
  type: string;
}

export type ApplyHandler = (
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
    type: string,
    input: ApplyInput,
    draft: ApplyDraft,
    review: ApplyReview
  ): Promise<ApplyResult> {
    const handler = this.handlers.get(type) ?? this.handlers.get('default');
    if (!handler) {
      throw new Error('No default apply handler registered');
    }
    return handler(input, draft, review);
  }
}

export function defaultHandler(
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
