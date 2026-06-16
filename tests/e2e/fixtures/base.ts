import { test as baseTest } from '@playwright/test';
import { apiHeaders } from './auth';

const apiBaseURL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3001';

/**
 * Custom Playwright fixtures for Mimir e2e tests.
 *
 * - `apiRequest`: a request context rooted at the API base URL so tests can
 *   call backend endpoints without hard-coding ports.
 */
export const test = baseTest.extend<{
  apiRequest: typeof baseTest.request;
}>({
  apiRequest: async ({ request }, use) => {
    const wrapped = new Proxy(request, {
      get(target, prop) {
        const value = (target as Record<string, unknown>)[prop as string];
        if (typeof value === 'function') {
          return (url: string, ...args: unknown[]) => {
            const absoluteUrl = url.startsWith('http') ? url : `${apiBaseURL}${url}`;
            return value.call(target, absoluteUrl, ...args);
          };
        }
        return value;
      },
    });
    await use(wrapped as typeof request);
  },
});

export { expect } from '@playwright/test';

export function apiRequestHeaders() {
  return apiHeaders();
}
