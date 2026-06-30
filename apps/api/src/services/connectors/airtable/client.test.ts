import { describe, expect, it, vi } from 'vitest';
import { AirtableClient } from './client';

const resolver = {
  get: vi.fn(),
  getForTenant: vi.fn().mockResolvedValue('airtable-token'),
  getRequired: vi.fn().mockResolvedValue('airtable-token'),
  getRequiredForTenant: vi.fn().mockResolvedValue('airtable-token'),
};

function mockFetch(response: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => response,
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('AirtableClient', () => {
  it('createRecord calls the Airtable API', async () => {
    const fetchMock = mockFetch({ id: 'rec-1', fields: { Name: 'New' } });
    const client = new AirtableClient({ tenantId: 't1', secretRef: 'airtable' }, resolver);
    const result = await client.createRecord({
      baseId: 'base-1',
      tableId: 'table-1',
      fields: { Name: 'New' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.airtable.com/v0/base-1/table-1',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ fields: { Name: 'New' } }),
        headers: expect.objectContaining({ Authorization: 'Bearer airtable-token' }),
      })
    );
    expect(result).toEqual({ id: 'rec-1', fields: { Name: 'New' } });
  });

  it('updateRecord calls the Airtable API', async () => {
    const fetchMock = mockFetch({ id: 'rec-1', fields: { Name: 'Updated' } });
    const client = new AirtableClient({ tenantId: 't1', secretRef: 'airtable' }, resolver);
    const result = await client.updateRecord({
      baseId: 'base-1',
      tableId: 'table-1',
      recordId: 'rec-1',
      fields: { Name: 'Updated' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.airtable.com/v0/base-1/table-1/rec-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ fields: { Name: 'Updated' } }),
      })
    );
    expect(result).toEqual({ id: 'rec-1', fields: { Name: 'Updated' } });
  });
});
