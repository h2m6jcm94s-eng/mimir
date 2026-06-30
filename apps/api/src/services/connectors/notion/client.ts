import type { SecretResolver } from '../../../config/secrets';

export interface NotionClientConfig {
  tenantId: string;
  secretRef: string;
}

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export class NotionClient {
  constructor(
    private readonly config: NotionClientConfig,
    private readonly resolver: SecretResolver
  ) {}

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Notion integration token not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const token = await this.token();
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Notion API error (${response.status}) ${url}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async search(input: { query?: string; pageSize: number }): Promise<unknown> {
    return this.request<unknown>(`${NOTION_API_BASE}/search`, {
      method: 'POST',
      body: JSON.stringify({
        query: input.query ?? '',
        page_size: input.pageSize,
      }),
    });
  }

  async getPage(input: { pageId: string }): Promise<unknown> {
    return this.request<unknown>(`${NOTION_API_BASE}/pages/${encodeURIComponent(input.pageId)}`);
  }

  async getDatabase(input: { databaseId: string }): Promise<unknown> {
    return this.request<unknown>(
      `${NOTION_API_BASE}/databases/${encodeURIComponent(input.databaseId)}`
    );
  }

  async queryDatabase(input: { databaseId: string; pageSize: number }): Promise<unknown> {
    return this.request<unknown>(
      `${NOTION_API_BASE}/databases/${encodeURIComponent(input.databaseId)}/query`,
      {
        method: 'POST',
        body: JSON.stringify({ page_size: input.pageSize }),
      }
    );
  }

  async appendBlockChildren(input: {
    blockId: string;
    children: Record<string, unknown>[];
  }): Promise<unknown> {
    return this.request<unknown>(
      `${NOTION_API_BASE}/blocks/${encodeURIComponent(input.blockId)}/children`,
      {
        method: 'PATCH',
        body: JSON.stringify({ children: input.children }),
      }
    );
  }
}
