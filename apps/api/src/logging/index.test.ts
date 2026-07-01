import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from './index';

function makeSink() {
  const sink = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
  sink.child = vi.fn(() => sink);
  return sink;
}

describe('Logger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.TELEMETRY_REDACT_T0 = undefined;
  });

  it('redacts secrets from messages and extras', () => {
    const sink = makeSink();
    const logger = new Logger(sink);
    logger.info('api_key=super-secret value', { token: 'abc123' });

    expect(sink.info).toHaveBeenCalled();
    const [bindings, msg] = sink.info.mock.calls[0] as [unknown, string];
    expect(msg).toContain('[REDACTED]');
    expect(msg).not.toContain('super-secret');
    expect((bindings as { extra: Record<string, unknown> }).extra.token).toBe('[REDACTED]');
  });

  it('scrubs T0 content when privacyTier is 0', () => {
    const sink = makeSink();
    const logger = new Logger(sink, { privacyTier: 0 });
    logger.info('request', { prompt: 'Email alice@example.com', payload: { ssn: '123-45-6789' } });

    const [bindings] = sink.info.mock.calls[0] as [unknown, string];
    const extra = (bindings as { extra: Record<string, unknown> }).extra;
    expect(extra.prompt).toBe('Email [EMAIL]');
    expect(extra.payload).toEqual({ ssn: '[SSN]' });
  });

  it('does not scrub non-T0 content by default', () => {
    const sink = makeSink();
    const logger = new Logger(sink, { privacyTier: 2 });
    logger.info('request', { prompt: 'Email alice@example.com' });

    const [bindings] = sink.info.mock.calls[0] as [unknown, string];
    const extra = (bindings as { extra: Record<string, unknown> }).extra;
    expect(extra.prompt).toBe('Email alice@example.com');
  });

  it('scrubs all tiers when TELEMETRY_REDACT_T0 is enabled', () => {
    process.env.TELEMETRY_REDACT_T0 = '1';
    const sink = makeSink();
    const logger = new Logger(sink, { privacyTier: 2 });
    logger.info('request', { prompt: 'Email alice@example.com' });

    const [bindings] = sink.info.mock.calls[0] as [unknown, string];
    const extra = (bindings as { extra: Record<string, unknown> }).extra;
    expect(extra.prompt).toBe('Email [EMAIL]');
  });

  it('propagates context to child loggers', () => {
    const sink = makeSink();
    const parent = new Logger(sink, { tenantId: 'tenant-1', privacyTier: 0 });
    const child = parent.child({ jobId: 'job-1' });
    child.info('event', { data: 'secret-123' });

    expect(sink.child).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', privacyTier: 0, jobId: 'job-1' })
    );
    const [bindings] = sink.info.mock.calls[0] as [unknown, string];
    const extra = (bindings as { extra: Record<string, unknown> }).extra;
    expect(extra.data).toBe('secret-123');
  });
});
