# RFC: F-012 gVisor sandbox + static-analysis gate

> Status: implemented (MVP). Target runtime for generated skills and other untrusted code in Mimir's self-improvement loop.

## 1. Problem

Mimir wants to run code it did not write — generated skill handlers, crawlers, user-submitted snippets, and third-party automation scripts. Running that code directly on a node would break the privacy-tier model and could expose secrets, exfiltrate data, or damage the host.

We need a default-deny execution environment that:

- Keeps untrusted code off the host kernel as much as possible.
- Blocks network egress and system access by default.
- Rejects obviously dangerous source patterns before execution.
- Is easy to exercise in CI where gVisor may not be installed.

## 2. Goals

1. Provide a `SandboxRunner` abstraction with a gVisor (`runsc`) implementation and a safe local passthrough fallback.
2. Provide a static-analysis gate that parses TypeScript/JavaScript and fails on dangerous constructs.
3. Expose HTTP endpoints for configuration, execution, analysis, and a combined gate.
4. Keep the feature runnable in local dev and CI without requiring `runsc`.

## 3. Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│  API route: POST /v1/sandbox/gate                           │
│    1. Parse request { code, run }                           │
│    2. Static analysis (ESLint + TS parser)                  │
│    3. If analysis fails → 400 STATIC_ANALYSIS_FAILED        │
│    4. Else run command in SandboxRunner                     │
│       • gVisor (runsc) when available / SANDBOX_MODE=gvisor │
│       • passthrough fallback otherwise                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Sandbox runner

`apps/api/src/services/sandbox/runner.ts`

- `SandboxRunInput`: `command`, optional `args`, `timeoutMs`, `env`, `workingDir`.
- `SandboxRunResult`: `stdout`, `stderr`, `exitCode`, `timedOut`.
- `createSandboxRunner()` selects the runner:
  - `SANDBOX_MODE=gvisor` → `GvisorSandboxRunner` (fails if `runsc` missing).
  - `SANDBOX_MODE=passthrough` → `PassthroughSandboxRunner`.
  - unset → auto-detect gVisor, fall back to passthrough.
- The gVisor runner invokes `runsc do --rootless --network=none --overlay` with a configurable timeout.
- The passthrough runner spawns the command directly and should only be used in local dev/CI with trusted workloads.

### 3.2 Static-analysis gate

`apps/api/src/services/sandbox/static-analysis.ts`

- Uses ESLint's `Linter` Node API with `@typescript-eslint/parser` so it can analyze both JavaScript and TypeScript.
- Registers the parser with `linter.defineParser(...)` so the dependency is explicit and does not rely on global ESLint resolution.
- Curated security rules:
  - `no-eval`, `no-implied-eval`, `no-new-func`
  - `no-restricted-globals` for `process`
  - `no-restricted-imports` / `no-restricted-modules` for system modules (`child_process`, `fs`, `net`, `http`, `https`, `os`, `cluster`, `dgram`, `dns`, `repl`, `tls`, `vm`, `worker_threads`, and `node:*` variants)
  - `no-restricted-syntax` selectors for:
    - dynamic `import()`
    - `require()`
    - `fetch`, `XMLHttpRequest`, `WebSocket`, `Worker`, `importScripts`
    - `process.env`
    - `__proto__` and constructor tampering
- Returns `{ ok, messages[] }` with line/column, severity, message, and `ruleId`.

### 3.3 Routes

`apps/api/src/routes/sandbox.ts`

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| GET | `/v1/sandbox/config` | `sandbox:read` | Active runner mode (`gvisor` or `passthrough`). |
| POST | `/v1/sandbox/run` | `sandbox:run` | Run a command in the sandbox. |
| POST | `/v1/sandbox/analyze` | `sandbox:analyze` | Analyze code without executing it. |
| POST | `/v1/sandbox/gate` | `sandbox:run` | Analyze code; run it only if analysis passes. |

RBAC roles:

- `owner` / `admin`: all sandbox scopes.
- `member`: `sandbox:analyze` so generated skills can be validated.
- `viewer`: no sandbox scopes.

## 4. Security model

- **Default deny:** gVisor runs with `--network=none` and `--overlay`; only explicitly allowed command/args reach the sandbox.
- **Fail closed:** If `SANDBOX_MODE=gvisor` is requested but `runsc` is missing, boot fails loudly rather than silently falling back.
- **Static analysis first:** The `/gate` endpoint refuses to run code that fails analysis.
- **No secrets in code:** `process.env` access is flagged, nudging generated skills toward explicit input schemas.
- **CI safety:** Without gVisor, passthrough mode is used; tests still exercise the same API surface.

## 5. Future work

- Resource limits (CPU, memory, disk) beyond wall-clock timeout. gVisor supports these through OCI specs; the local fallback can use `prlimit` on Linux.
- Python sandbox support via `bandit` + a Python gVisor image for generated Python skills.
- `semgrep` or `eslint-plugin-security` integration for richer rule coverage.
- Tier enforcement: prevent sandboxed code from accessing data above the request's privacy tier.
- Approval workflow integration: wire `/gate` failures into the existing approvals/review loop so Mimir can propose fixes.

## 6. Test plan

| Layer | Coverage |
|-------|----------|
| Unit | `static-analysis.test.ts` covers safe TS/JS, eval, `new Function`, banned imports, dynamic import, `fetch`, `WebSocket`, `process.env`, `__proto__`, and constructor tampering. |
| Integration | `sandbox.integration.test.ts` covers config, passthrough run, static analysis, gate rejection, gate success, and a real gVisor run when `runsc` is installed. |
| CI | All sandbox tests run with `RUN_DB_TESTS=1`; gVisor-specific test is skipped when `runsc` is absent. |
