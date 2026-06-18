import type { SecretResolver } from '../../../config/secrets';

export interface GoogleContactsClientConfig {
  tenantId: string;
  secretRef: string;
}

export class GoogleContactsClient {
  constructor(
    private readonly config: GoogleContactsClientConfig,
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
      throw new Error(`Google Contacts API error (${response.status}) ${url}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async listContacts(input: { pageSize: number; pageToken?: string }): Promise<unknown> {
    const params = new URLSearchParams();
    params.set('pageSize', String(input.pageSize));
    params.set('personFields', 'names,emailAddresses,phoneNumbers');
    if (input.pageToken) params.set('pageToken', input.pageToken);
    return this.request<unknown>(
      `https://people.googleapis.com/v1/people/me/connections?${params.toString()}`
    );
  }

  async getContact(input: { resourceName: string }): Promise<unknown> {
    return this.request<unknown>(
      `https://people.googleapis.com/v1/${encodeURIComponent(
        input.resourceName
      )}?personFields=names,emailAddresses,phoneNumbers`
    );
  }

  async createContact(input: {
    givenName: string;
    familyName?: string;
    email?: string;
    phoneNumber?: string;
  }): Promise<unknown> {
    const body: Record<string, unknown> = {
      names: [
        { givenName: input.givenName, ...(input.familyName && { familyName: input.familyName }) },
      ],
    };
    if (input.email) {
      body.emailAddresses = [{ value: input.email }];
    }
    if (input.phoneNumber) {
      body.phoneNumbers = [{ value: input.phoneNumber }];
    }
    return this.request<unknown>('https://people.googleapis.com/v1/people:createContact', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}
