import type { SecretResolver } from '../../../config/secrets';

export interface SlackClientConfig {
  tenantId: string;
  secretRef: string;
}

export class SlackClient {
  constructor(
    private readonly config: SlackClientConfig,
    private readonly resolver: SecretResolver
  ) {}

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Slack bot token not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private async slackRequest<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const token = await this.token();
    const response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slack API HTTP error (${response.status}) ${method}: ${text}`);
    }

    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (data.ok === false) {
      throw new Error(`Slack API error ${method}: ${data.error ?? 'unknown'}`);
    }

    return data as T;
  }

  async listChannels(input: { types: string; limit: number }): Promise<unknown> {
    return this.slackRequest<unknown>('conversations.list', {
      types: input.types,
      limit: input.limit,
    });
  }

  async getMessages(input: { channelId: string; limit: number }): Promise<unknown> {
    return this.slackRequest<unknown>('conversations.history', {
      channel: input.channelId,
      limit: input.limit,
    });
  }

  async sendMessage(input: { channelId: string; text: string }): Promise<unknown> {
    return this.slackRequest<unknown>('chat.postMessage', {
      channel: input.channelId,
      text: input.text,
    });
  }
}
