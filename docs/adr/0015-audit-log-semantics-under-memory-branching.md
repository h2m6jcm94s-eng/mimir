# ADR-0015: Audit-Log Semantics Under Memory Branching

## Status

proposed

## Context

Memory supports branching/rewind/restore via `session.parent_id` and `memory_node.valid_from/valid_to` (§9.2). The audit log is currently described as a linear hash chain (`prev_hash` → `hash`) with a Merkle tree for subset verification (§13.2). When memory branches, "replay state at time T" becomes ambiguous: the same timestamp may exist on multiple branches, and a linear chain cannot represent forks.

## Decision

To be decided. Options include: (a) keep the audit chain linear and record branch creation as a single event, accepting that replay follows the current branch only; (b) make the audit log a Merkle DAG where branch events have multiple children; (c) store branch pointers in a separate layer above a linear chain.

## Consequences

The choice affects M4/M5 data model design, the temporal-replay implementation, and how tamper-evidence is proven across memory forks. This ADR must be accepted before coding the time-machine + audit integration.
