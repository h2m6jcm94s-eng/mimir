import { describe, expect, it, vi } from 'vitest';
import { NotionClient } from './client';

const resolver = {
  get: vi.fn(),
  getForTenant: vi.fn().mockResolvedValue('notion-token'),
  getRequired: vi.fn().mockResolvedValue('notion-token'),
  getRequiredForTenant: vi.fn().mockResolvedValue('notion-token'),
};

function mockFetch(response: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => response,
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('NotionClient', () => {
  it('search calls the Notion API', async () => {
    const fetchMock = mockFetch({ results: [{ id: 'page-1' }] });
    const client = new NotionClient({ tenantId: 't1', secretRef: 'notion' }, resolver);
    const result = await client.search({ query: 'meeting', pageSize: 5 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.notion.com/v1/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'meeting', page_size: 5 }),
        headers: expect.objectContaining({
          Authorization: 'Bearer notion-token',
          'Notion-Version': '2022-06-28',
        }),
      })
    );
    expect(result).toEqual({ results: [{ id: 'page-1' }] });
  });

  it('getPage calls the Notion API', async () => {
    const fetchMock = mockFetch({ id: 'page-1', title: 'Notes' });
    const client = new NotionClient({ tenantId: 't1', secretRef: 'notion' }, resolver);
    const result = await client.getPage({ pageId: 'page-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.notion.com/v1/pages/page-1',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer notion-token' }),
      })
    );
    expect(result).toEqual({ id: 'page-1', title: 'Notes' });
  });

  it('queryDatabase calls the Notion API', async () => {
    const fetchMock = mockFetch({ results: [{ id: 'row-1' }] });
    const client = new NotionClient({ tenantId: 't1', secretRef: 'notion' }, resolver);
    const result = await client.queryDatabase({ databaseId: 'db-1', pageSize: 10 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.notion.com/v1/databases/db-1/query',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ page_size: 10 }),
      })
    );
    expect(result).toEqual({ results: [{ id: 'row-1' }] });
  });

  it('appendBlockChildren calls the Notion API', async () => {
    const fetchMock = mockFetch({ id: 'block-1' });
    const client = new NotionClient({ tenantId: 't1', secretRef: 'notion' }, resolver);
    const children = [{ type: 'paragraph', paragraph: { text: [{ text: { content: 'hi' } }] } }];
    const result = await client.appendBlockChildren({ blockId: 'page-1', children });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.notion.com/v1/blocks/page-1/children',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ children }),
      })
    );
    expect(result).toEqual({ id: 'block-1' });
  });
});
