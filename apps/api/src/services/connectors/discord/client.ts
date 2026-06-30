import type { SecretResolver } from '../../../config/secrets';

export interface DiscordClientConfig {
  tenantId: string;
  secretRef: string;
}

export class DiscordClient {
  constructor(
    private readonly config: DiscordClientConfig,
    private readonly resolver: SecretResolver
  ) {}

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Discord bot token not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.token();
    const response = await fetch(`https://discord.com/api/v10${path}`, {
      ...init,
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Discord API error (${response.status}) ${path}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async listChannels(input: { guildId: string }): Promise<unknown> {
    return this.request<unknown>(`/guilds/${encodeURIComponent(input.guildId)}/channels`);
  }

  async getMessages(input: {
    channelId: string;
    limit: number;
    before?: string;
  }): Promise<unknown> {
    const params = new URLSearchParams();
    params.set('limit', String(input.limit));
    if (input.before) params.set('before', input.before);
    return this.request<unknown>(
      `/channels/${encodeURIComponent(input.channelId)}/messages?${params.toString()}`
    );
  }

  async sendMessage(input: { channelId: string; content: string }): Promise<unknown> {
    return this.request<unknown>(`/channels/${encodeURIComponent(input.channelId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: input.content }),
    });
  }

  async createDm(recipientId: string): Promise<{ id: string }> {
    return this.request<{ id: string }>('/users/@me/channels', {
      method: 'POST',
      body: JSON.stringify({ recipient_id: recipientId }),
    });
  }

  async sendDm(input: { recipientId: string; content: string }): Promise<unknown> {
    const channel = await this.createDm(input.recipientId);
    return this.sendMessage({ channelId: channel.id, content: input.content });
  }
}
