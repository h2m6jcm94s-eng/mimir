import { getEffectiveConfig } from './config';

export interface ApiClientOptions {
  apiUrl?: string;
  apiKey?: string;
}

export class ApiClient {
  private apiUrl: string;
  private apiKey: string;

  constructor(options?: ApiClientOptions) {
    const config = getEffectiveConfig();
    this.apiUrl = options?.apiUrl || config.apiUrl;
    this.apiKey = options?.apiKey || config.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async get(path: string): Promise<unknown> {
    const response = await fetch(`${this.apiUrl}${path}`, { headers: this.headers() });
    return this.handleResponse(response);
  }

  async post(path: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  private async handleResponse(response: Response): Promise<unknown> {
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${JSON.stringify(data)}`);
    }
    return data;
  }
}
