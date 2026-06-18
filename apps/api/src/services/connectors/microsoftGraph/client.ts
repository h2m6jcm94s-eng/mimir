import type { SecretResolver } from '../../../config/secrets';

export interface MicrosoftGraphClientConfig {
  tenantId: string;
  secretRef: string;
}

export class MicrosoftGraphClient {
  constructor(
    private readonly config: MicrosoftGraphClientConfig,
    private readonly resolver: SecretResolver
  ) {}

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Microsoft Graph access token not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.token();
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Microsoft Graph API error (${response.status}) ${path}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async listMessages(input: { top: number; filter?: string }): Promise<unknown> {
    const params = new URLSearchParams();
    params.set('$top', String(input.top));
    if (input.filter) params.set('$filter', input.filter);
    return this.request<unknown>(`/me/messages?${params.toString()}`);
  }

  async getMessage(input: { id: string }): Promise<unknown> {
    return this.request<unknown>(`/me/messages/${encodeURIComponent(input.id)}`);
  }

  async sendMessage(input: { to: string; subject: string; body: string }): Promise<unknown> {
    return this.request<unknown>('/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: 'text', content: input.body },
          toRecipients: [{ emailAddress: { address: input.to } }],
        },
      }),
    });
  }
}
