import type { SecretResolver } from '../../../config/secrets';

export interface StripeClientConfig {
  tenantId: string;
  secretRef: string;
}

export class StripeClient {
  private baseUrl = 'https://api.stripe.com/v1';

  constructor(
    private readonly config: StripeClientConfig,
    private readonly resolver: SecretResolver
  ) {}

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Stripe secret key not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private async request<T>(path: string, params?: URLSearchParams): Promise<T> {
    const token = await this.token();
    const query = params ? `?${params.toString()}` : '';
    const response = await fetch(`${this.baseUrl}${path}${query}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = (await response.json()) as T & { error?: { message: string } };
    if (!response.ok || data.error) {
      throw new Error(
        `Stripe API error (${response.status}) ${path}: ${data.error?.message ?? JSON.stringify(data)}`
      );
    }
    return data;
  }

  async listCharges(input: {
    limit: number;
    createdAfter?: string;
    createdBefore?: string;
  }): Promise<unknown> {
    const params = new URLSearchParams({ limit: String(input.limit) });
    if (input.createdAfter)
      params.set('created[gte]', String(Math.floor(new Date(input.createdAfter).getTime() / 1000)));
    if (input.createdBefore)
      params.set(
        'created[lte]',
        String(Math.floor(new Date(input.createdBefore).getTime() / 1000))
      );
    return this.request<unknown>('/charges', params);
  }

  async listSubscriptions(input: { limit: number; status: string }): Promise<unknown> {
    const params = new URLSearchParams({ limit: String(input.limit) });
    if (input.status !== 'all') params.set('status', input.status);
    return this.request<unknown>('/subscriptions', params);
  }

  async listPayouts(input: { limit: number }): Promise<unknown> {
    const params = new URLSearchParams({ limit: String(input.limit) });
    return this.request<unknown>('/payouts', params);
  }
}
