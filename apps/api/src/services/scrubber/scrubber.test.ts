import { describe, expect, it } from 'vitest';
import { scrubForTier, scrubValue } from './scrubber';

describe('IdentifierScrubber', () => {
  it('leaves T0/T1 input untouched', () => {
    const input = { apiKey: 'sk-12345678', host: 'server.local' };
    expect(scrubForTier(input, 0)).toEqual(input);
    expect(scrubForTier(input, 1)).toEqual(input);
  });

  it('redacts secrets in T2 input', () => {
    const input = { note: 'api_key: sk-12345678 and password: super-secret' };
    const scrubbed = scrubForTier(input, 2);
    expect((scrubbed as { note: string }).note).toBe('[REDACTED_SECRET] and [REDACTED_SECRET]');
  });

  it('redacts hostnames and IPs', () => {
    const input = 'Connect to db.corp.internal at 10.0.0.5';
    const scrubbed = scrubValue(input);
    expect(scrubbed).toBe('Connect to [HOSTNAME] at [IP]');
  });

  it('redacts proprietary markers', () => {
    const input = 'This document is internal only and confidential';
    const scrubbed = scrubValue(input);
    expect(scrubbed).toBe('This document is [REDACTED] and [REDACTED]');
  });
});
