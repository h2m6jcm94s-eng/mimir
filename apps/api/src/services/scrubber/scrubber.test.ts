import { describe, expect, it } from 'vitest';
import { scrubForTier, scrubValue } from './scrubber';

describe('IdentifierScrubber', () => {
  it('leaves T0 input untouched', () => {
    const input = { apiKey: 'sk-12345678', host: 'server.local' };
    expect(scrubForTier(input, 0)).toEqual(input);
  });

  it('scrubs secrets and PII before T1 dispatch', () => {
    const input = { note: 'api_key: sk-12345678 and password: super-secret' };
    const scrubbed = scrubForTier(input, 1);
    expect((scrubbed as { note: string }).note).toBe('[REDACTED_SECRET] and [REDACTED_SECRET]');
  });

  it('scrubs secrets and PII before T2 dispatch', () => {
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

  it('redacts email addresses', () => {
    const input = 'Contact alice@example.com for details';
    expect(scrubValue(input)).toBe('Contact [EMAIL] for details');
  });

  it('redacts phone numbers', () => {
    const input = 'Call me at 555-555-5555';
    expect(scrubValue(input)).toBe('Call me at [PHONE]');
  });

  it('redacts social security numbers', () => {
    const input = 'SSN 123-45-6789';
    expect(scrubValue(input)).toBe('SSN [SSN]');
  });

  it('redacts credit card numbers', () => {
    const input = 'Card: 4111 1111 1111 1111';
    expect(scrubValue(input)).toBe('Card: [CREDIT_CARD]');
  });

  it('redacts national ID-like numbers', () => {
    const input = 'ID: 123456-78-9012';
    expect(scrubValue(input)).toBe('ID: [ID]');
  });
});
