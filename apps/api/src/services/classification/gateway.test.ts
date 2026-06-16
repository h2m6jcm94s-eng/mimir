import { describe, expect, it } from 'vitest';
import { ClassificationGateway } from './gateway';

describe('ClassificationGateway', () => {
  const gateway = new ClassificationGateway();

  it('defaults to conservative T0 fallback for bland prompts', () => {
    const result = gateway.classify({ prompt: 'say hello', attachments: [], retrievedContext: [] });
    expect(result.tier).toBe(0);
    expect(result.fallback).toBe(true);
  });

  it('tags PII and secrets as T0', () => {
    const result = gateway.classify({
      prompt: 'My ssn is 123-45-6789 and password is secret123',
      attachments: [],
      retrievedContext: [],
    });
    expect(result.tier).toBe(0);
    expect(result.reason).toContain('pii_or_secrets');
  });

  it('tags explicitly public tasks as T2', () => {
    const result = gateway.classify({
      prompt: 'Check the weather and read the public page news',
      attachments: [],
      retrievedContext: [],
    });
    expect(result.tier).toBe(2);
    expect(result.fallback).toBe(false);
  });

  it('considers attachment names in classification', () => {
    const result = gateway.classify({
      prompt: 'review this',
      attachments: [{ name: 'private_key.pem', contentType: 'text/plain', size: 128 }],
      retrievedContext: [],
    });
    expect(result.tier).toBe(0);
  });
});
