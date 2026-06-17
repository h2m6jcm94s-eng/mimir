import type { SecretResolver } from '../../../config/secrets';

export interface LemonSqueezyClientConfig {
  tenantId: string;
  secretRef: string;
}

export class LemonSqueezyClient {
  private baseUrl = 'https://api.lemonsqueezy.com/v1';

  constructor(
    private readonly config: LemonSqueezyClientConfig,
    private readonly resolver: SecretResolver
  ) {}

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Lemon Squeezy API key not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private async request<T>(path: string, params?: URLSearchParams): Promise<T> {
    const token = await this.token();
    const query = params ? `?${params.toString()}` : '';
    const response = await fetch(`${this.baseUrl}${path}${query}`, {
      headers: {
        Accept: 'application/vnd.api+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.api+json',
      },
    });

    const data = (await response.json()) as T & { errors?: Array<{ detail: string }> };
    if (!response.ok || data.errors) {
      throw new Error(
        `Lemon Squeezy API error (${response.status}) ${path}: ${data.errors?.[0]?.detail ?? JSON.stringify(data)}`
      );
    }
    return data;
  }

  async listOrders(input: { limit: number }): Promise<unknown> {
    const params = new URLSearchParams({ 'page[size]': String(input.limit) });
    return this.request<unknown>('/orders', params);
  }

  async listSubscriptions(input: { limit: number }): Promise<unknown> {
    const params = new URLSearchParams({ 'page[size]': String(input.limit) });
    return this.request<unknown>('/subscriptions', params);
  }
}
