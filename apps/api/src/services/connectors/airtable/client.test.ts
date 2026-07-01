import { describe, expect, it, vi } from 'vitest';
import { AirtableClient } from './client';

const resolver = {
  get: vi.fn(),
  getForTenant: vi.fn().mockResolvedValue('airtable-token'),
  setForTenant: vi.fn().mockResolvedValue(undefined),
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

  it('listAllRecords follows pagination until exhausted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            { id: 'rec-1', createdTime: '2024-01-01T00:00:00.000Z', fields: { Name: 'A' } },
          ],
          offset: 'offset-1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          records: [
            { id: 'rec-2', createdTime: '2024-01-02T00:00:00.000Z', fields: { Name: 'B' } },
          ],
        }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new AirtableClient({ tenantId: 't1', secretRef: 'airtable' }, resolver);
    const records = [];
    for await (const record of client.listAllRecords({ baseId: 'base-1', tableId: 'table-1' })) {
      records.push(record);
    }

    expect(records).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('offset=offset-1');
  });
});
