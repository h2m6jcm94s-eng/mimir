# Manual Feature Verification Checklist

Run these steps after `make up` and `pnpm dev` are healthy and before merging the batch.

## Prerequisites

- Postgres, Redis, and Temporal are running (`make up`).
- API is running (`pnpm --filter @mimir/api dev`) on `http://localhost:3001`.
- Web app is running (`pnpm --filter @mimir/web dev`) on `http://localhost:3000`.
- You are signed in as a tenant admin.

---

## F-015 — Real embeddings + vector semantic search

1. Ingest a document:
   ```bash
   curl -s -X POST http://localhost:3001/v1/knowledge \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"kind":"doc","uri":"file:///manual/test.txt","content":"PostgreSQL is a powerful open-source relational database.","tier":2}'
   ```
2. Full-text search (default):
   ```bash
   curl -s "http://localhost:3001/v1/knowledge/search?q=PostgreSQL&limit=5" \
     -H "Authorization: Bearer <token>"
   ```
   - Expect results containing "PostgreSQL" and `score` present.
3. Vector search:
   ```bash
   curl -s "http://localhost:3001/v1/knowledge/search?q=open%20source%20database&searchMode=vector&limit=5" \
     -H "Authorization: Bearer <token>"
   ```
   - Expect results and `score` > 0.
4. Hybrid search:
   ```bash
   curl -s "http://localhost:3001/v1/knowledge/search?q=relational%20database&searchMode=hybrid&limit=5" \
     -H "Authorization: Bearer <token>"
   ```
   - Expect merged results from FTS and vector.
5. (Optional with `OPENAI_API_KEY`) Verify ingest logs show OpenAI embeddings used; otherwise fake embeddings are used and search still works.

---

## Google OAuth — Gmail, Google Contacts, Google Docs, Google Sheets

1. Set environment variables in `.env`:
   ```bash
   GOOGLE_CLIENT_ID=<your-client-id>
   GOOGLE_CLIENT_SECRET=<your-client-secret>
   GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/connectors/google/callback
   ```
2. Open the web app and go to **Connectors**.
3. For each of `gmail`, `googleContacts`, `googleDocs`, `googleSheets`:
   - Click **Connect with …**.
   - Complete the Google OAuth consent flow.
   - Return to Mimir and confirm the connector status is `connected` and an account email is shown.
4. Verify tokens are stored:
   ```bash
   # If using env fallback, look for MIMIR_SECRET_GMAIL_<tenantId> etc.
   # If using a vault, check the tenant-scoped key `gmail`.
   ```
5. For Google Sheets, optionally test a read action:
   ```bash
   curl -s -X POST http://localhost:3001/v1/connectors/googleSheets/actions/listSheets \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"spreadsheetId":"<sheet-id>","tier":1}'
   ```

---

## CSV / XLSX / Google Sheets sync handlers

1. **CSV sync**
   - Create a CSV connector (no credentials needed).
   - Trigger sync:
     ```bash
     curl -s -X POST http://localhost:3001/v1/connectors/csv/actions/sync \
       -H "Authorization: Bearer <token>" \
       -H "Content-Type: application/json" \
       -d '{"content":"Name,Age\nAlice,30\nBob,25","sourceName":"people"}'
     ```
   - Expect `{ applied: true, output: { ingested: 2 } }`.
   - Search for "Alice" in knowledge and confirm a row result appears.

2. **XLSX sync**
   - Create an XLSX connector.
   - Base64-encode a small `.xlsx` file (e.g. with `Name,Age` rows).
   - Trigger sync with `base64Content`, `fileName`, and `sheetName`.
   - Expect row counts and knowledge items.

3. **Google Sheets sync**
   - Complete Google OAuth for `googleSheets` (see above).
   - Trigger sync:
     ```bash
     curl -s -X POST http://localhost:3001/v1/connectors/googleSheets/actions/sync \
       -H "Authorization: Bearer <token>" \
       -H "Content-Type: application/json" \
       -d '{"spreadsheetId":"<sheet-id>","range":"Sheet1","maxRows":100}'
     ```
   - Expect rows ingested into knowledge graph.

---

## Interactive workflow visual editor

1. Open `http://localhost:3000/workflow-editor`.
2. Select an existing workflow or generate one via `/api/v1/workflows/generate`.
3. In the editor:
   - Click **+ trigger** and **+ action** to add nodes.
   - Click **Connect**, then click a source node and a target node to draw an edge.
   - Select an edge and set a **Condition**.
   - Drag nodes to rearrange them.
   - Select a node and edit its **Label** and **Kind**.
4. Click **Save**.
5. Refresh the page and reload the same workflow.
   - Confirm added nodes, edges, positions, labels, and conditions persist.
6. Run the workflow via `/api/v1/workflows/:id/run` and check that the run completes.

---

## Device-scoped workflow runtime

1. Register a device/node for the tenant and mark it `up` (or use an existing `up` node).
2. Create or pick a workflow routine and set its `nodeId` to that node:
   ```bash
   curl -s -X PATCH http://localhost:3001/v1/routines/<routine-id> \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"nodeId":"<node-id>"}'
   ```
3. Trigger the routine run:
   ```bash
   curl -s -X POST http://localhost:3001/v1/routines/<routine-id>/run \
     -H "Authorization: Bearer <token>"
   ```
   - Expect success / `done`.
4. Mark the node `down` (e.g. via heartbeat endpoint or DB update).
5. Trigger the routine again.
   - Expect the run to fail with `NODE_UNAVAILABLE` in the run metadata.
6. Mark the node `up` again and trigger once more.
   - Expect success.

---

## Sign-off

- [ ] F-015 embeddings/vector search verified
- [ ] Google OAuth verified for all four connector kinds
- [ ] CSV, XLSX, and Google Sheets sync verified
- [ ] Interactive workflow editor verified (add, connect, edit, save, reload)
- [ ] Device-scoped runtime verified (node up/down gates execution)
