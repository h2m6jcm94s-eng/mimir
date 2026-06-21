import { describe, expect, it } from 'vitest';
import { renderCloudInit } from './cloud-init';

describe('renderCloudInit', () => {
  it('renders a base64-encoded cloud-config with substituted tokens', () => {
    const rendered = renderCloudInit({
      tailscaleAuthKey: 'tskey-test',
      webhookUrl: 'https://example.com/webhook',
      jobPayloadBase64: Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64'),
    });

    const decoded = Buffer.from(rendered, 'base64').toString('utf-8');
    expect(decoded.startsWith('#cloud-config')).toBe(true);
    expect(decoded).toContain('tskey-test');
    expect(decoded).toContain('https://example.com/webhook');
    expect(decoded).toContain('tag:cloud');
  });
});
