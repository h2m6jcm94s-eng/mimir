/**
 * Stable hash helper for cycle detection in the review loop.
 *
 * The first cut uses a canonical JSON hash. A true AST diff can be swapped in
 * later without changing the interface.
 */

import { createHash } from 'node:crypto';

function canonicalStringify(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

export function hashObject(value: unknown): string {
  const canonical = canonicalStringify(value);
  return createHash('sha256').update(canonical).digest('hex');
}

export function hashDiff(a: unknown, b: unknown): string {
  return hashObject({ before: a, after: b });
}
