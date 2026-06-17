import { describe, expect, it, vi } from 'vitest';
import { MetaClient } from './client';

const resolver = {
  get: vi.fn(),
  getForTenant: vi.fn().mockResolvedValue('meta-token'),
};

describe('MetaClient', () => {
  it('listPages calls the Graph API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'page1', name: 'Page' }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new MetaClient({ tenantId: 't1', secretRef: 'meta' }, resolver);
    const result = await client.listPages({ limit: 10 });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/me/accounts');
    expect(url).toContain('limit=10');
    expect(url).toContain('access_token=meta-token');
    expect(result).toEqual({ data: [{ id: 'page1', name: 'Page' }] });
  });

  it('publishPost calls the Graph API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'post123' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new MetaClient({ tenantId: 't1', secretRef: 'meta' }, resolver);
    const result = await client.publishPost({
      pageId: 'page1',
      message: 'Hello',
      link: 'https://example.com',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/page1/feed');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      message: 'Hello',
      link: 'https://example.com',
      access_token: 'meta-token',
    });
    expect(result).toEqual({ id: 'post123' });
  });

  it('publishMedia creates a container then publishes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'container1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'media123' }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new MetaClient({ tenantId: 't1', secretRef: 'meta' }, resolver);
    const result = await client.publishMedia({
      igUserId: 'user1',
      imageUrl: 'https://img.jpg',
      caption: 'caption',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: 'media123' });
  });
});
