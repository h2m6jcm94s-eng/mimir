import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';

/**
 * Test authentication helpers.
 *
 * The API accepts a bearer token of "test" in local/development environments.
 * The Next.js app bypasses Clerk middleware when PLAYWRIGHT_TEST is true,
 * so web tests can treat the app as already signed in.
 */
export const TEST_TOKEN = 'test';

export async function withApiContext(context: APIRequestContext) {
  return context;
}

export function apiHeaders() {
  return {
    Authorization: `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export async function signInAsTestUser(context: BrowserContext) {
  await context.addCookies([
    {
      name: 'mimir_test_session',
      value: '1',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

export function expectSignedInPage(page: Page) {
  return page;
}
