import { describe, expect, it, vi } from 'vitest';
import { PinterestClient } from './client';

const resolver = {
  get: vi.fn(),
  getForTenant: vi.fn().mockResolvedValue('pinterest-token'),
  getRequired: vi.fn().mockResolvedValue('pinterest-token'),
  getRequiredForTenant: vi.fn().mockResolvedValue('pinterest-token'),
};

describe('PinterestClient', () => {
  it('listBoards calls the Pinterest API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: 'board1', name: 'Board' }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new PinterestClient({ tenantId: 't1', secretRef: 'pinterest' }, resolver);
    const result = await client.listBoards({ limit: 10 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/boards');
    expect(url).toContain('page_size=10');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer pinterest-token',
    });
    expect(result).toEqual({ items: [{ id: 'board1', name: 'Board' }] });
  });

  it('createPin calls the Pinterest API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pin123' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new PinterestClient({ tenantId: 't1', secretRef: 'pinterest' }, resolver);
    const result = await client.createPin({
      boardId: 'board1',
      title: 'Pin title',
      description: 'desc',
      link: 'https://example.com',
      mediaSource: 'https://img.jpg',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/pins');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      board_id: 'board1',
      title: 'Pin title',
      media_source: { source_type: 'image_url', url: 'https://img.jpg' },
    });
    expect(result).toEqual({ id: 'pin123' });
  });
});
