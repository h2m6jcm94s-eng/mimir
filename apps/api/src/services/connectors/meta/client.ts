import type { SecretResolver } from '../../../config/secrets';

export interface MetaClientConfig {
  tenantId: string;
  secretRef: string;
  apiVersion?: string;
}

export class MetaClient {
  private apiVersion: string;

  constructor(
    private readonly config: MetaClientConfig,
    private readonly resolver: SecretResolver
  ) {
    this.apiVersion = config.apiVersion ?? 'v19.0';
  }

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Meta access token not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private baseUrl(): string {
    return `https://graph.facebook.com/${this.apiVersion}`;
  }

  private buildUrl(path: string, params?: URLSearchParams): string {
    const query = params ? `?${params.toString()}` : '';
    return `${this.baseUrl()}${path.startsWith('/') ? '' : '/'}${path}${query}`;
  }

  async get<T>(path: string, params?: URLSearchParams): Promise<T> {
    const token = await this.token();
    const search = params ?? new URLSearchParams();
    search.set('access_token', token);
    const response = await fetch(this.buildUrl(path, search));
    const data = (await response.json()) as T & { error?: { message: string } };
    if (!response.ok || data.error) {
      throw new Error(
        `Meta API error (${response.status}) ${path}: ${data.error?.message ?? JSON.stringify(data)}`
      );
    }
    return data;
  }

  async post<T>(path: string, body?: Record<string, unknown>): Promise<T> {
    const token = await this.token();
    const response = await fetch(this.buildUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, access_token: token }),
    });
    const data = (await response.json()) as T & { error?: { message: string } };
    if (!response.ok || data.error) {
      throw new Error(
        `Meta API error (${response.status}) ${path}: ${data.error?.message ?? JSON.stringify(data)}`
      );
    }
    return data;
  }

  // Facebook
  async listPages(input: { limit: number }): Promise<unknown> {
    return this.get<unknown>('/me/accounts', new URLSearchParams({ limit: String(input.limit) }));
  }

  async listPosts(input: { pageId: string; limit: number }): Promise<unknown> {
    return this.get<unknown>(
      `/${input.pageId}/posts`,
      new URLSearchParams({ limit: String(input.limit) })
    );
  }

  async publishPost(input: { pageId: string; message: string; link?: string }): Promise<unknown> {
    return this.post<unknown>(`/${input.pageId}/feed`, {
      message: input.message,
      ...(input.link ? { link: input.link } : {}),
    });
  }

  // Instagram
  async listMedia(input: { igUserId: string; limit: number }): Promise<unknown> {
    return this.get<unknown>(
      `/${input.igUserId}/media`,
      new URLSearchParams({
        limit: String(input.limit),
        fields: 'id,caption,media_type,media_url,permalink',
      })
    );
  }

  async getMedia(input: { mediaId: string }): Promise<unknown> {
    return this.get<unknown>(
      `/${input.mediaId}`,
      new URLSearchParams({ fields: 'id,caption,media_type,media_url,permalink' })
    );
  }

  async publishMedia(input: {
    igUserId: string;
    imageUrl: string;
    caption: string;
  }): Promise<unknown> {
    const container = (await this.post<{ id: string }>(`/${input.igUserId}/media`, {
      image_url: input.imageUrl,
      caption: input.caption,
    })) as { id: string };

    return this.post<unknown>(`/${input.igUserId}/media_publish`, {
      creation_id: container.id,
    });
  }

  // WhatsApp
  async getBusinessProfile(input: { phoneNumberId: string }): Promise<unknown> {
    return this.get<unknown>(
      `/${input.phoneNumberId}/whatsapp_business_profile`,
      new URLSearchParams({
        fields: 'about,description,address,email,profile_picture_url,websites',
      })
    );
  }

  async sendWhatsAppMessage(input: {
    phoneNumberId: string;
    to: string;
    text: string;
  }): Promise<unknown> {
    return this.post<unknown>(`/${input.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.to,
      type: 'text',
      text: { body: input.text },
    });
  }
}
