# Browser Extension Quick Capture Guide

Clip web pages and selected text directly into your Mimir second brain without leaving the tab.

## What you need

- A running Mimir API (`apps/api`) and web app (`apps/web`).
- You are signed in to the Mimir web app so the session cookie exists.
- Chrome, Edge, or another Chromium-based browser that supports Manifest V3.

## Install the extension

1. Build the extension:

   ```bash
   cd /path/to/mimir
   pnpm --filter @mimir/extension build
   ```

2. Open Chrome/Edge and navigate to `chrome://extensions/` (or `edge://extensions/`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and select `apps/extension/dist/`.
5. The Mimir icon should appear in the toolbar.

## Configure the API URL

1. Right-click the Mimir toolbar icon and choose **Options**.
2. Enter your Mimir API base URL, for example `http://localhost:3001`.
3. Click **Save**.

## Capture a page

- Click the Mimir toolbar icon on any web page.
- The toolbar badge shows a green checkmark (✓) on success or a red cross (✕) if the capture failed.

## Capture a selection

1. Select text on any web page.
2. Right-click the selection and choose **Capture selection to Mimir**.
3. The badge shows the result.

## Use the keyboard shortcut

Press `Ctrl+Shift+M` (Windows/Linux) or `Cmd+Shift+M` (macOS) to capture the current page.

## Where captures go

Each capture creates a `knowledge_item` of kind `note` in your tenant. Open the Mimir web app and go to **Knowledge** (`/knowledge`) to see the captured page or selection. The note includes:

- The page title as a heading.
- The page URL as a source line.
- The page body or selected text as Markdown content.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Red ✕ badge after capture | Not signed in to Mimir, API unreachable, or missing host permission | Sign in at `http://localhost:3000`, check the API URL in options, and verify the extension has host permission for the API origin |
| Capture never appears in `/knowledge` | Delayed sync or wrong tenant | Refresh the knowledge page and check you are signed in to the same tenant |
| Extension icon missing | Not pinned to toolbar | Click the browser’s extensions puzzle icon and pin Mimir |

## Out of scope for v1

- Chrome Web Store / Firefox Add-ons publication (the build produces an unpacked extension; store submission is a separate distribution task).
- Screenshot / image capture.
- Automatic tag suggestion.
- Mobile Safari extension.
