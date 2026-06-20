# ADR 0026 — Browser extension quick capture

**Status:** Accepted  
**Date:** 2026-06-21  
**Author:** devayan

## Context

Most knowledge that should live in Mimir arrives while the user is browsing: articles, documentation, forum threads, and ideas. There is no fast way to get these into the second brain without copying text, switching tabs, and pasting into the web app. A browser extension is the cheapest distribution surface for Mimir and the fastest capture path for F-071 (second brain).

## Options

| Option | Pros | Cons |
|---|---|---|
| A. Manifest V3 extension with content script + service worker | Native capture flow, works on any page, fast | Cross-origin cookie auth needs care; requires packaging per store |
| B. Web app “share target” / bookmarklet | No install store, trivial to deploy | No context-menu or keyboard shortcut; clunky on mobile |
| C. Native desktop agent that watches clipboard | Works without browser extension | Misses page URL/title context; requires running agent |

## Recommendation

**Option A — Manifest V3 extension.**

- A content script extracts page body or current selection and sends it to the service worker.
- The service worker posts to the existing `POST /v1/capture` endpoint.
- Auth reuses the user’s Supertokens session cookie via the `chrome.cookies` API (with host permission for the Mimir API origin), avoiding a separate API key flow in v1.
- Toolbar click, context-menu entries, and a keyboard shortcut (`Ctrl/Cmd+Shift+M`) all trigger capture.
- Success/error feedback is shown as a temporary badge on the toolbar icon so the user never leaves the page.

## Decisions

1. **Package location:** `apps/extension/` so it is built alongside the API and web app.
2. **Build output:** `esbuild` bundles TypeScript entries; `dist/` contains `manifest.json`, HTML, and bundled JS ready to load as an unpacked extension or zip.
3. **Capture payload:** title, URL, and body/selection are formatted as Markdown and posted to `POST /v1/capture` with `{ content, tier: 0, tags }`.
4. **Tier default:** tier `0` is requested; the classification gateway on the API raises it only if no local model is available, preserving the privacy-first default.
5. **Auth mechanism:** `chrome.cookies.getAll({ url: apiUrl })` builds a manual `Cookie` header for the cross-origin request to the Mimir API. If the user is not signed in, the request returns `401` and the badge shows failure.
6. **Configuration:** an options page lets the user set the Mimir API base URL (defaults to `http://localhost:3001`).

## Risks

- **Cookie access:** host permission for the Mimir API origin is required. If the API moves to a different origin, the user must update the extension options and manifest host permission.
- **Store policy:** Manifest V3 service workers have limited lifetime. Capture is fire-and-forget; long-running tasks should be handled by the API, not the extension.
- **Cross-browser differences:** Firefox supports MV3 but some APIs differ. The initial target is Chromium/Chrome/Edge; Firefox packaging is a follow-up.

## Related work

- F-085 implementation issue: `docs/issues/F-085-browser-extension-quick-capture.md`
- F-071 second brain RFC: `docs/rfcs/F-071-second-brain-self-improvement.md`
- Capture endpoint: `apps/api/src/routes/capture.ts`
- Extension source: `apps/extension/`
