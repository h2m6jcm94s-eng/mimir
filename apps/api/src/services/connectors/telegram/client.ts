import type { SecretResolver } from '../../../config/secrets';

export interface TelegramClientConfig {
  tenantId: string;
  secretRef: string;
}

export class TelegramClient {
  constructor(
    private readonly config: TelegramClientConfig,
    private readonly resolver: SecretResolver
  ) {}

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`Telegram bot token not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private async request<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const token = await this.token();
    const url = `https://api.telegram.org/bot${token}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Telegram API error (${response.status}) ${method}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async getChat(input: { chatId: string | number }): Promise<unknown> {
    return this.request<unknown>('getChat', { chat_id: input.chatId });
  }

  async sendMessage(input: { chatId: string | number; text: string }): Promise<unknown> {
    return this.request<unknown>('sendMessage', {
      chat_id: input.chatId,
      text: input.text,
    });
  }

  async setWebhook(input: { url: string; secretToken: string }): Promise<unknown> {
    return this.request<unknown>('setWebhook', {
      url: input.url,
      secret_token: input.secretToken,
      allowed_updates: ['message', 'edited_message'],
    });
  }
}
