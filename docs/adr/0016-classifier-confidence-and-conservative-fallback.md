# ADR-0016 — Classifier Confidence and Conservative Fallback

**Status:** Accepted  
**Date:** 2026-06-17  
**Author:** devayan

## Context

The data-classification gateway assigns every request a privacy tier T0/T1/T2 (§10.3). The original spec did not define how the gateway behaves when confidence is low, nor did it require a human-review queue for borderline classifications. Misclassification is the biggest remaining T0-leakage risk (R-15).

## Decision

When the classifier's confidence is below the configured threshold, **always route to T0** (the most private tier). This is the conservative default: better to run locally and pay a latency/compute cost than to leak sensitive data to a less-trusted tier.

### Rationale

- T0 leakage is irreversible and catastrophic; over-classification only costs local compute.
- A simple, deterministic rule is auditable and testable in CI.
- It aligns with Mimir's promise that a request's tier never widens.
- Future work (F-017 governance-as-code) can introduce a review queue or policy override, but the baseline must be conservative.

### Consequences

- More requests than necessary will run on Tier 0/1 hardware, increasing local compute usage until the classifier improves.
- Every fallback decision is flagged (`fallback: true`) and audited, so we can measure and tune the rule set.
- Conformance tests can assert: "any classification with `fallback: true` has `tier: 0`" and "Tier 0 never reaches a cloud provider."

## Related

- `ROADMAP.md` §M2-3 (Classification gateway + policy stub)
- `docs/adr/0019-tier-enforcement-interception-point.md`
- Implementation: `apps/api/src/services/classification/gateway.ts`
