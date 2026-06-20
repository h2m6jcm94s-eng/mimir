# F-085 — Browser extension quick capture for distribution

**Tier:** Free · **Priority:** P1 · **Status:** Implemented

## Problem / motivation

Most knowledge that should live in Mimir arrives while the user is browsing: articles, snippets, documentation, forum threads, and ideas. There is no fast way to get these into the second brain without copying text, switching tabs, and pasting into the web app. A browser extension is the cheapest distribution surface for Mimir and the fastest capture path for F-071 (second brain).

## Proposed solution

Build a Manifest V3 browser extension that clips content and posts it to the existing `POST /v1/capture` endpoint.

1. **Extension package** at `apps/extension/` or `packages/extension/`:
   - `manifest.json` v3 with host permission for the Mimir origin.
   - Service worker for event handling.
   - Content script for selection/page extraction.
   - Popup UI for quick capture with tags/tier/privacy hint.
2. **Auth**: reuse the web app session cookie (SameSite/Lax or via native messaging later); for v1, authenticate by cookie against `/v1/capture`.
3. **Capture modes**:
   - **Page**: title + URL + reader-mode-like body markdown.
   - **Selection**: selected text + page URL + title.
   - **Screenshot** (optional v1.1): capture visible area as image attachment.
4. **Quick actions**:
   - Toolbar icon → capture page.
   - Context menu → “Capture selection to Mimir”.
   - Keyboard shortcut (e.g. `Ctrl/Cmd+Shift+M`).
5. **Web app integration**:
   - `/knowledge` page shows capture source = `extension`.
   - Toast/notification on successful capture.

## Acceptance criteria

- [x] Extension builds to a loadable `.zip` / unpacked directory.
- [x] User can install it in Chrome/Edge/Firefox (Manifest V3 compatible).
- [x] Clicking the toolbar icon captures the current page into Mimir as a `knowledge_item` of kind `note`.
- [x] Right-clicking selected text and choosing “Capture selection to Mimir” creates a note with the selection and page URL.
- [x] Capture posts with tier `0` by default (classification gateway can raise if local model unavailable).
- [x] Extension shows success/error feedback via toolbar badge without leaving the page.

## Test plan

- **Unit:** content script extraction produces clean markdown; popup form validates.
- **Integration:** extension posts to `/v1/capture` and the note appears in the tenant’s knowledge graph.
- **E2E (real local API + Playwright):**
  1. Load the unpacked extension in a Playwright Chromium context.
  2. Navigate to a test page.
  3. Click the toolbar icon.
  4. Open Mimir web app, go to `/knowledge`, assert the captured page appears with correct URL/title.
  5. Repeat for context-menu selection capture.
- **Manual:** load in Firefox/Chrome, verify icons, permissions, and capture flow.

## Out of scope

- Chrome Web Store / Firefox Add-ons publication (packaging only; store submission is a separate distribution task).
- Native messaging or background sync.
- Screenshot OCR in v1.
- Automatic tag suggestion via model.
- Mobile Safari extension.
