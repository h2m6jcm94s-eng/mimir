export class MimirError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MimirError';
  }
}

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TENANT_ISOLATION_VIOLATION: 'TENANT_ISOLATION_VIOLATION',
} as const;
