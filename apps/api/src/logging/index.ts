import type { FastifyBaseLogger } from 'fastify';
import { scrubValue } from '../services/scrubber/scrubber';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  tenantId?: string;
  jobId?: string;
  privacyTier?: number;
  traceId?: string;
}

function telemetryRedactT0Enabled(): boolean {
  return process.env.TELEMETRY_REDACT_T0 === '1' || process.env.TELEMETRY_REDACT_T0 === 'true';
}

const SENSITIVE_PATTERNS = [
  /api[_-]?key["']?\s*[:=]\s*["']?[\w-]+/gi,
  /password["']?\s*[:=]\s*["']?[^\s"']+/gi,
  /token["']?\s*[:=]\s*["']?[^\s"']+/gi,
];

function redactString(input: string): string {
  return SENSITIVE_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, '[REDACTED]'), input);
}

function isSensitiveKey(key: string): boolean {
  return /api[_-]?key|token|secret|password|passwd|pwd|private[_-]?key/i.test(key);
}

function redactValue(value: unknown, key?: string): unknown {
  if (typeof value === 'string') {
    if (key && isSensitiveKey(key)) return '[REDACTED]';
    return redactString(value);
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item, key));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, nested]) => [entryKey, redactValue(nested, entryKey)])
    );
  }
  return value;
}

export interface LogSink {
  debug(msg: unknown, ...args: unknown[]): void;
  info(msg: unknown, ...args: unknown[]): void;
  warn(msg: unknown, ...args: unknown[]): void;
  error(msg: unknown, ...args: unknown[]): void;
  child(bindings: Record<string, unknown>): LogSink;
}

class ConsoleLogSink implements LogSink {
  child(): LogSink {
    return this;
  }

  debug(bindings: unknown, ...rest: unknown[]): void {
    this.write(console.debug, bindings, rest);
  }

  info(bindings: unknown, ...rest: unknown[]): void {
    this.write(console.log, bindings, rest);
  }

  warn(bindings: unknown, ...rest: unknown[]): void {
    this.write(console.warn, bindings, rest);
  }

  error(bindings: unknown, ...rest: unknown[]): void {
    this.write(console.error, bindings, rest);
  }

  private write(
    sink: (message?: unknown, ...optionalParams: unknown[]) => void,
    bindings: unknown,
    rest: unknown[]
  ): void {
    const extra =
      typeof bindings === 'object' && bindings !== null
        ? (bindings as Record<string, unknown>).extra
        : undefined;
    const message = rest.length > 0 ? rest[0] : bindings;
    if (extra === undefined) {
      sink(message);
    } else {
      sink(message, bindings);
    }
  }
}

function safeClone(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => safeClone(item, seen));
    }
    const obj = value as Record<string, unknown>;
    const clone: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(obj)) {
      clone[key] = safeClone(nested, seen);
    }
    return clone;
  } finally {
    seen.delete(value);
  }
}

export class Logger {
  private readonly ctx: LogContext;

  constructor(
    private readonly base: LogSink | FastifyBaseLogger,
    ctx: LogContext = {}
  ) {
    this.ctx = ctx;
  }

  child(ctx: LogContext): Logger {
    return new Logger(this.base.child({ ...this.ctx, ...ctx }), { ...this.ctx, ...ctx });
  }

  debug(msg: string, extra?: Record<string, unknown>) {
    this.base.debug({ extra: this.prepare(extra) }, redactString(msg));
  }

  info(msg: string, extra?: Record<string, unknown>) {
    this.base.info({ extra: this.prepare(extra) }, redactString(msg));
  }

  warn(msg: string, extra?: Record<string, unknown>) {
    this.base.warn({ extra: this.prepare(extra) }, redactString(msg));
  }

  error(msg: string, extra?: Record<string, unknown>) {
    this.base.error({ extra: this.prepare(extra) }, redactString(msg));
  }

  private prepare(extra?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!extra) return undefined;
    try {
      const cloned = safeClone(extra) as Record<string, unknown>;
      const redacted = redactValue(cloned) as Record<string, unknown>;
      if (this.ctx.privacyTier === 0 || telemetryRedactT0Enabled()) {
        return scrubValue(redacted) as Record<string, unknown>;
      }
      return redacted;
    } catch (err) {
      return { _logPrepareError: err instanceof Error ? err.message : String(err) };
    }
  }
}

export function createLogger(base: LogSink | FastifyBaseLogger): Logger {
  return new Logger(base);
}

export const rootLogger = new Logger(new ConsoleLogSink());
