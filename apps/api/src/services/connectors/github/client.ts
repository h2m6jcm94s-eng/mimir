import type { SecretResolver } from '../../../config/secrets';

export interface GitHubClientConfig {
  tenantId: string;
  secretRef: string;
  account?: string | null;
}

export class GitHubClient {
  private baseUrl = 'https://api.github.com';

  constructor(
    private readonly config: GitHubClientConfig,
    private readonly resolver: SecretResolver
  ) {}

  private async token(): Promise<string> {
    const value = await this.resolver.getForTenant(this.config.tenantId, this.config.secretRef);
    if (!value) {
      throw new Error(`GitHub token not found for tenant ${this.config.tenantId}`);
    }
    return value;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${await this.token()}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub API error (${response.status}) ${url}: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async listRepos(input: { type?: string; perPage?: number }): Promise<unknown[]> {
    const params = new URLSearchParams();
    params.set('type', input.type ?? 'all');
    params.set('per_page', String(input.perPage ?? 30));

    if (this.config.account) {
      return this.request<unknown[]>(
        `/orgs/${encodeURIComponent(this.config.account)}/repos?${params}`
      );
    }
    return this.request<unknown[]>(`/user/repos?${params}`);
  }

  async getIssue(input: { owner: string; repo: string; issueNumber: number }): Promise<unknown> {
    return this.request<unknown>(
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/issues/${input.issueNumber}`
    );
  }

  async getPullRequest(input: {
    owner: string;
    repo: string;
    pullNumber: number;
  }): Promise<unknown> {
    return this.request<unknown>(
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls/${input.pullNumber}`
    );
  }

  async getFile(input: {
    owner: string;
    repo: string;
    path: string;
    ref?: string;
  }): Promise<{ content: string; encoding: string; name: string; path: string }> {
    const params = input.ref ? `?ref=${encodeURIComponent(input.ref)}` : '';
    const file = await this.request<{
      content: string;
      encoding: string;
      name: string;
      path: string;
    }>(
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${encodeURIComponent(
        input.path
      )}${params}`
    );
    if (file.encoding === 'base64') {
      file.content = Buffer.from(file.content, 'base64').toString('utf-8');
    }
    return file;
  }

  async openPr(input: {
    owner: string;
    repo: string;
    title: string;
    body: string;
    head: string;
    base: string;
  }): Promise<unknown> {
    return this.request<unknown>(
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/pulls`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: input.title,
          body: input.body,
          head: input.head,
          base: input.base,
        }),
      }
    );
  }
}
