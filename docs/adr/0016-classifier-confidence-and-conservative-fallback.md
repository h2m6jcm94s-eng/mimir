# ADR-0016: Classifier Confidence and Conservative Fallback

## Status

proposed

## Context

The data-classification gateway assigns every request a privacy tier T0/T1/T2 (§10.3). The current spec does not define how the gateway behaves when confidence is low, nor does it require a human-review queue for borderline classifications. Misclassification is the biggest remaining T0-leakage risk (R-15).

## Decision

To be decided. Options include: (a) always route to T0 when classifier confidence is below a tunable threshold; (b) route to T0 only when no policy rule matches and surface a review notice; (c) require human approval for any classification that differs from a deterministic policy rule.

## Consequences

The decision determines the false-positive rate (more T0 routing = higher local cost), the latency of the classification step, and the shape of the audit/conformance tests. This ADR must be accepted before M2-3 implementation.
