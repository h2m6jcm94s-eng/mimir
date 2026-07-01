import { afterEach, describe, expect, it, vi } from 'vitest';
import { GitHubClient } from './client';

class FakeResolver {
  async get(): Promise<string | undefined> {
    return undefined;
  }

  async getForTenant(): Promise<string | undefined> {
    return 'test-token';
  }

  async getRequired(): Promise<string> {
    return 'test-token';
  }

  async getRequiredForTenant(): Promise<string> {
    return 'test-token';
  }

  async setForTenant(): Promise<void> {
    // no-op
  }
}

function makeClient(account?: string) {
  return new GitHubClient(
    {
      tenantId: '00000000-0000-0000-0000-000000000000',
      secretRef: 'github',
      account: account ?? null,
    },
    new FakeResolver()
  );
}

describe('GitHubClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists user repos', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, full_name: 'user/repo' }],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = makeClient();
    const repos = await client.listRepos({});

    expect(repos).toEqual([{ id: 1, full_name: 'user/repo' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/user/repos');
  });

  it('lists org repos when account is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 2, full_name: 'org/repo' }],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = makeClient('acme');
    const repos = await client.listRepos({});

    expect(repos).toEqual([{ id: 2, full_name: 'org/repo' }]);
    expect(fetchMock.mock.calls[0][0]).toContain('/orgs/acme/repos');
  });

  it('fetches an issue', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ number: 42, title: 'Bug' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = makeClient();
    const issue = await client.getIssue({ owner: 'acme', repo: 'app', issueNumber: 42 });

    expect(issue).toEqual({ number: 42, title: 'Bug' });
    expect(fetchMock.mock.calls[0][0]).toContain('/repos/acme/app/issues/42');
  });

  it('fetches and decodes a file', async () => {
    const content = Buffer.from('hello world').toString('base64');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content, encoding: 'base64', name: 'readme.md', path: 'readme.md' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = makeClient();
    const file = await client.getFile({ owner: 'acme', repo: 'app', path: 'readme.md' });

    expect(file.content).toBe('hello world');
    expect(fetchMock.mock.calls[0][0]).toContain('/repos/acme/app/contents/readme.md');
  });

  it('opens a pull request', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ number: 7, html_url: 'https://github.com/acme/app/pull/7' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = makeClient();
    const pr = (await client.openPr({
      owner: 'acme',
      repo: 'app',
      title: 'Fix bug',
      body: 'Details',
      head: 'feature',
      base: 'main',
    })) as { number: number; html_url: string };

    expect(pr.number).toBe(7);
    expect(fetchMock.mock.calls[0][0]).toContain('/repos/acme/app/pulls');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
  });

  it('throws on GitHub API errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = makeClient();
    await expect(client.getIssue({ owner: 'acme', repo: 'app', issueNumber: 99 })).rejects.toThrow(
      'GitHub API error'
    );
  });
});
