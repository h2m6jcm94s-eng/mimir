import type { SecretResolver } from '../../../config/secrets';

export interface GmailClientConfig {
  tenantId: string;
  secretRef: string;
}

export class GmailClient {
  constructor(
    private readonly config: GmailClientConfig,
    private readonly resolver: SecretResolver
  ) {}

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Gmail access token not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.token();
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gmail API error (${response.status}) ${path}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async listMessages(input: { maxResults: number; query: string }): Promise<unknown> {
    const params = new URLSearchParams();
    params.set('maxResults', String(input.maxResults));
    if (input.query) params.set('q', input.query);
    return this.request<unknown>(`/users/me/messages?${params.toString()}`);
  }

  async getMessage(input: { id: string }): Promise<unknown> {
    return this.request<unknown>(`/users/me/messages/${encodeURIComponent(input.id)}?format=full`);
  }

  async sendMessage(input: { to: string; subject: string; body: string }): Promise<unknown> {
    const raw = Buffer.from(
      `To: ${input.to}\r\nSubject: ${input.subject}\r\n\r\n${input.body}`
    ).toString('base64url');
    return this.request<unknown>('/users/me/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw }),
    });
  }
}
