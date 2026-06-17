import type { SecretResolver } from '../../../config/secrets';

export interface PinterestClientConfig {
  tenantId: string;
  secretRef: string;
  apiVersion?: string;
}

export class PinterestClient {
  private apiVersion: string;

  constructor(
    private readonly config: PinterestClientConfig,
    private readonly resolver: SecretResolver
  ) {
    this.apiVersion = config.apiVersion ?? 'v5';
  }

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Pinterest access token not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private baseUrl(): string {
    return `https://api.pinterest.com/${this.apiVersion}`;
  }

  private buildUrl(path: string, params?: URLSearchParams): string {
    const query = params ? `?${params.toString()}` : '';
    return `${this.baseUrl()}${path.startsWith('/') ? '' : '/'}${path}${query}`;
  }

  private async request<T>(
    method: string,
    path: string,
    params?: URLSearchParams,
    body?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.token();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
    const init: RequestInit = { method };

    if (body && method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    init.headers = headers;

    const response = await fetch(this.buildUrl(path, params), init);
    const data = (await response.json()) as T & { message?: string };
    if (!response.ok) {
      throw new Error(
        `Pinterest API error (${response.status}) ${path}: ${data.message ?? JSON.stringify(data)}`
      );
    }
    return data;
  }

  async listBoards(input: { limit: number }): Promise<unknown> {
    return this.request<unknown>(
      'GET',
      '/boards',
      new URLSearchParams({ page_size: String(input.limit) })
    );
  }

  async listPins(input: { boardId: string; limit: number }): Promise<unknown> {
    return this.request<unknown>(
      'GET',
      `/boards/${input.boardId}/pins`,
      new URLSearchParams({ page_size: String(input.limit) })
    );
  }

  async createPin(input: {
    boardId: string;
    title: string;
    description: string;
    link?: string;
    mediaSource: string;
  }): Promise<unknown> {
    return this.request<unknown>('POST', '/pins', undefined, {
      board_id: input.boardId,
      title: input.title,
      description: input.description,
      link: input.link,
      media_source: {
        source_type: 'image_url',
        url: input.mediaSource,
      },
    });
  }
}
