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

  it('tags credit-card-like numbers as T0', () => {
    const result = gateway.classify({
      prompt: 'Charge card 4111 1111 1111 1111 please',
      attachments: [],
      retrievedContext: [],
    });
    expect(result.tier).toBe(0);
    expect(result.reason).toContain('pii_or_secrets');
  });

  it('tags local-compute tasks as T1', () => {
    const result = gateway.classify({
      prompt: 'Render this video on my desktop using ollama',
      attachments: [],
      retrievedContext: [],
    });
    expect(result.tier).toBe(1);
    expect(result.reason).toContain('local_compute');
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

  it('considers attachment MIME types in classification', () => {
    const result = gateway.classify({
      prompt: 'review this',
      attachments: [{ name: 'cert.p12', contentType: 'application/x-pkcs12', size: 128 }],
      retrievedContext: [],
    });
    expect(result.tier).toBe(0);
  });

  it('always falls back to T0 when confidence is low', () => {
    // A single, low-weight match should not be enough to escape T0.
    const result = gateway.classify({
      prompt: 'news',
      attachments: [],
      retrievedContext: [],
    });
    expect(result.tier).toBe(0);
    expect(result.fallback).toBe(true);
  });

  it('prefers the most restrictive tier when T0 and T2 signals overlap', () => {
    const result = gateway.classify({
      prompt: 'My password is secret123 and also check the weather',
      attachments: [],
      retrievedContext: [],
    });
    expect(result.tier).toBe(0);
    expect(result.reason).toContain('pii_or_secrets');
  });

  it('always returns a valid tier and falls back to T0 on low confidence', () => {
    const randomString = (length: number) => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*() ';
      return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    };

    for (let i = 0; i < 100; i++) {
      const prompt = randomString(Math.floor(Math.random() * 200));
      const result = gateway.classify({ prompt, attachments: [], retrievedContext: [] });
      expect([0, 1, 2]).toContain(result.tier);
      if (result.fallback) {
        expect(result.tier).toBe(0);
      }
    }
  });
});
