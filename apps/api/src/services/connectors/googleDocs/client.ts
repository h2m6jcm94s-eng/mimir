import type { SecretResolver } from '../../../config/secrets';

export interface GoogleDocsClientConfig {
  tenantId: string;
  secretRef: string;
}

export class GoogleDocsClient {
  constructor(
    private readonly config: GoogleDocsClientConfig,
    private readonly resolver: SecretResolver
  ) {}

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Google access token not found for tenant ${this.config.tenantId}`);
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
      throw new Error(`Google Docs API error (${response.status}) ${url}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async getDocument(input: { documentId: string }): Promise<unknown> {
    return this.request<unknown>(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(input.documentId)}`
    );
  }

  async createDocument(input: { title: string }): Promise<unknown> {
    return this.request<unknown>('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      body: JSON.stringify({ title: input.title }),
    });
  }
}
