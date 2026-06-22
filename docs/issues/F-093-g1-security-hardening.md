# F-093 — Close Gate G1 security hardening gaps (R‑01..R‑06, R‑15)

**Status:** 🟦 in‑progress  
**Priority:** P0 — blocks all reliability/governance claims and revenue gates  
**Owner:** core  
**Target:** 2026‑07 (close G1 before any new feature work)  

## Why now

`ROADMAP.md` §24 lists six open 🔴/🟠 risks (R‑01..R‑06) plus R‑15 that contradict Mimir’s core sales claim. M10 (lines 1847‑1858) says the exit gate is **zero critical/high risks open** before the 30‑day dogfood run. The G1 dependency note (line 2077) warns that these risks compete for the same infra/security bandwidth and any slippage blocks every reliability/governance claim.

We are deliberately pausing new features (F‑045, F‑028, etc.) until G1 is green.

## Gap inventory and acceptance

| Risk | Required mitigation | Current state | Acceptance |
|---|---|---|---|
| **R‑01** | gVisor `runsc` + static‑analysis gate + **human approval** before generated/agent code runs; no auto‑exec from chat | Sandbox runner exists but falls back to passthrough, no approval gate, ESLint‑only static analysis, not wired to skills/chat | `SANDBOX_MODE=gvisor` enforced in prod; `/v1/sandbox/execute` creates an approval; static analysis blocks dangerous code; chat/connector cannot trigger execution |
| **R‑02** | Classification gateway tags T0/T1/T2; sensitive data → local/Claude; ID scrubbing before cloud; routing logged | Classifier + scrubber exist and are used, but core secrets still read from env and some model paths may bypass scrubber | Scrubber applied to every T2 model call; audit logs every routing decision; env fallback removed for core secrets |
| **R‑03** | External lock / conditional write + API fencing + read‑only during transition | Fencing epoch exists in Postgres but is read‑then‑update (racey); no external witness | `bumpEpoch` is atomic conditional write; promotion requires winning an external lock or witness quorum |
| **R‑04** | LibSQL embedded replicas + fencing‑epoch auto‑promote (zero loss) | LibSQL client present but default is local file; sync is Postgres→SQLite push; no auto‑promote | Replicas stream from `sqld`/primary; failover controller detects brain death, elects freshest replica, bumps epoch, promotes |
| **R‑05** | LUKS FDE + SQLCipher for `state.db` + secrets vault + ephemeral SSH CA | `state.db` is plaintext SQLite; core secrets read from `process.env`; SSH CA node certs are short‑lived but CA private keys are static | SQLCipher enabled by default; vault resolver used for all secrets; no plaintext `.env` in prod; CA keys rotated/TPM‑backed |
| **R‑06** | Tailscale tag ACLs default‑deny + air‑gapped cloud worker | ACL design exists but is manually applied; API provisioning bypasses hardened Terraform SG/IAM | ACL applied via CI/Terraform; API‑provisioned workers attach hardened SG/IAM; network policy test passes |
| **R‑15** | Confidence threshold + conservative T0 fallback + classifier‑vs‑policy conformance test | Classifier has threshold and fallback, but no conformance/property test that decisions never widen tier | Property test + CI gate: classifier output tier ≤ policy max tier; low‑confidence always falls back to T0 |

## Execution order

We will land this as a stack of small PRs, one risk at a time, in dependency order:

1. **R‑15** — classifier conformance test + audit logging (fast, unblocks R‑02 acceptance)
2. **R‑01** — enforce gVisor in production, add approval gate to sandbox execution, add bandit/semgrep rules, prevent chat/connector auto‑trigger
3. **R‑02** — ensure scrubber runs on every T2 payload, close env‑fallback paths for core secrets (prep for R‑05)
4. **R‑06** — automate Tailscale ACL deploy, harden API cloud‑worker provisioning, add network policy test
5. **R‑03** — make `bumpEpoch` atomic, add external lock/witness (Postgres conditional write or lightweight etcd)
6. **R‑04** — wire LibSQL embedded replicas, build failover controller
7. **R‑05** — SQLCipher bootstrap, migrate all secrets to vault resolver, ephemeral SSH CA key lifecycle

## After G1

Once all risks above are closed and the security re‑review passes:

- Build **F‑045 Compliance policy packs** (SOC2/GDPR/EU AI Act/HIPAA).
- Begin continuous **F‑028 Observability** work (metrics/traces/logs, tier‑redacted).

## Out of scope

- New chat surfaces, marketplace, voice, or NixOS (F‑033) until G1 is green.
- SOC 2 auditor engagement (G6) — that is a 2027‑Q1 commercial milestone, not engineering code.
