import type { FastifyBaseLogger } from 'fastify';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  tenantId?: string;
  jobId?: string;
  privacyTier?: number;
  traceId?: string;
}

const SENSITIVE_PATTERNS = [
  /api[_-]?key["']?\s*[:=]\s*["']?[\w-]+/gi,
  /password["']?\s*[:=]\s*["']?[^\s"']+/gi,
  /token["']?\s*[:=]\s*["']?[^\s"']+/gi,
];

function redact(input: string): string {
  return SENSITIVE_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '[REDACTED]'), input);
}

export class Logger {
  constructor(private readonly base: FastifyBaseLogger) {}

  child(ctx: LogContext): Logger {
    return new Logger(this.base.child(ctx));
  }

  debug(msg: string, extra?: Record<string, unknown>) {
    this.base.debug({ extra: this.prepare(extra) }, redact(msg));
  }

  info(msg: string, extra?: Record<string, unknown>) {
    this.base.info({ extra: this.prepare(extra) }, redact(msg));
  }

  warn(msg: string, extra?: Record<string, unknown>) {
    this.base.warn({ extra: this.prepare(extra) }, redact(msg));
  }

  error(msg: string, extra?: Record<string, unknown>) {
    this.base.error({ extra: this.prepare(extra) }, redact(msg));
  }

  private prepare(extra?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!extra) return undefined;
    const serialized = JSON.stringify(extra);
    return JSON.parse(redact(serialized));
  }
}

export function createLogger(base: FastifyBaseLogger): Logger {
  return new Logger(base);
}
