/**
 * Global teardown for Mimir e2e tests.
 *
 * Currently a no-op: Playwright's webServer handling shuts down the dev servers.
 * Add test artifact cleanup here when needed.
 */
export default async function globalTeardown() {
  console.log('[e2e teardown] Done.');
}
