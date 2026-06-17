import type { SecretResolver } from '../../../config/secrets';

export interface PaddleClientConfig {
  tenantId: string;
  secretRef: string;
}

export class PaddleClient {
  private baseUrl = 'https://api.paddle.com';

  constructor(
    private readonly config: PaddleClientConfig,
    private readonly resolver: SecretResolver
  ) {}

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Paddle API key not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private async request<T>(path: string, params?: URLSearchParams): Promise<T> {
    const token = await this.token();
    const query = params ? `?${params.toString()}` : '';
    const response = await fetch(`${this.baseUrl}${path}${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Paddle-Version': '1',
      },
    });

    const data = (await response.json()) as T & { error?: { detail: string } };
    if (!response.ok || data.error) {
      throw new Error(
        `Paddle API error (${response.status}) ${path}: ${data.error?.detail ?? JSON.stringify(data)}`
      );
    }
    return data;
  }

  async listTransactions(input: { limit: number; after?: string }): Promise<unknown> {
    const params = new URLSearchParams({ per_page: String(input.limit) });
    if (input.after) params.set('after', input.after);
    return this.request<unknown>('/transactions', params);
  }

  async listSubscriptions(input: { limit: number }): Promise<unknown> {
    const params = new URLSearchParams({ per_page: String(input.limit) });
    return this.request<unknown>('/subscriptions', params);
  }
}
