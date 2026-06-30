import type { SecretResolver } from '../../../config/secrets';

export interface AirtableClientConfig {
  tenantId: string;
  secretRef: string;
}

export class AirtableClient {
  constructor(
    private readonly config: AirtableClientConfig,
    private readonly resolver: SecretResolver
  ) {}

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Airtable API token not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const token = await this.token();
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Airtable API error (${response.status}) ${url}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async listBases(input: { offset?: string }): Promise<unknown> {
    const params = new URLSearchParams();
    if (input.offset) params.set('offset', input.offset);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<unknown>(`https://api.airtable.com/v0/meta/bases${query}`);
  }

  async listRecords(input: {
    baseId: string;
    tableId: string;
    maxRecords: number;
    offset?: string;
  }): Promise<unknown> {
    const params = new URLSearchParams();
    params.set('maxRecords', String(input.maxRecords));
    if (input.offset) params.set('offset', input.offset);
    return this.request<unknown>(
      `https://api.airtable.com/v0/${encodeURIComponent(input.baseId)}/${encodeURIComponent(
        input.tableId
      )}?${params.toString()}`
    );
  }

  async getRecord(input: { baseId: string; tableId: string; recordId: string }): Promise<unknown> {
    return this.request<unknown>(
      `https://api.airtable.com/v0/${encodeURIComponent(input.baseId)}/${encodeURIComponent(
        input.tableId
      )}/${encodeURIComponent(input.recordId)}`
    );
  }

  async createRecord(input: {
    baseId: string;
    tableId: string;
    fields: Record<string, unknown>;
  }): Promise<unknown> {
    return this.request<unknown>(
      `https://api.airtable.com/v0/${encodeURIComponent(input.baseId)}/${encodeURIComponent(
        input.tableId
      )}`,
      {
        method: 'POST',
        body: JSON.stringify({ fields: input.fields }),
      }
    );
  }

  async updateRecord(input: {
    baseId: string;
    tableId: string;
    recordId: string;
    fields: Record<string, unknown>;
  }): Promise<unknown> {
    return this.request<unknown>(
      `https://api.airtable.com/v0/${encodeURIComponent(input.baseId)}/${encodeURIComponent(
        input.tableId
      )}/${encodeURIComponent(input.recordId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ fields: input.fields }),
      }
    );
  }
}
