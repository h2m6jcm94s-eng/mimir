/**
 * Minimal, safe RFC-6902-style JSON Patch applier.
 *
 * Supports the subset needed by the review loop: add, remove, replace, test.
 * move/copy are rejected for now to keep the first iteration simple and safe.
 */

import type { JsonPatchOperation } from '@mimir/shared-types';

export type { JsonPatchOperation };

const DISALLOWED_PATHS = new Set(['/tier', '/tenantId', '/userId', '/jobId', '/idempotencyKey']);

function decodeSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function parsePointer(pointer: string): string[] {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) {
    throw new Error(`Invalid JSON pointer: ${pointer}`);
  }
  return pointer.slice(1).split('/').map(decodeSegment);
}

function getParent(target: unknown, segments: string[]): { parent: unknown; key: string | number } {
  let current = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (Array.isArray(current)) {
      const index = segment === '-' ? current.length : Number(segment);
      if (!Number.isFinite(index) || index < 0 || index > current.length) {
        throw new Error(`Patch path segment out of bounds: ${segment}`);
      }
      current = current[index];
    } else if (current !== null && typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
    } else {
      throw new Error(`Cannot traverse path segment: ${segment}`);
    }
  }
  const last = segments[segments.length - 1];
  return { parent: current, key: last };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function setValue(parent: unknown, key: string | number, value: unknown): void {
  if (Array.isArray(parent)) {
    const index = key === '-' ? parent.length : Number(key);
    if (!Number.isFinite(index) || index < 0 || index > parent.length) {
      throw new Error(`Array index out of bounds: ${key}`);
    }
    if (key === '-' || index === parent.length) {
      parent.push(value);
    } else {
      parent[index] = value;
    }
  } else if (parent !== null && typeof parent === 'object') {
    (parent as Record<string, unknown>)[String(key)] = value;
  } else {
    throw new Error('Cannot set value on non-object parent');
  }
}

function removeValue(parent: unknown, key: string | number): void {
  if (Array.isArray(parent)) {
    const index = Number(key);
    if (!Number.isFinite(index) || index < 0 || index >= parent.length) {
      throw new Error(`Array index out of bounds: ${key}`);
    }
    parent.splice(index, 1);
  } else if (parent !== null && typeof parent === 'object') {
    delete (parent as Record<string, unknown>)[String(key)];
  } else {
    throw new Error('Cannot remove from non-object parent');
  }
}

function getValue(target: unknown, segments: string[]): unknown {
  let current = target;
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isFinite(index) || index < 0 || index >= current.length) {
        throw new Error(`Array index out of bounds: ${segment}`);
      }
      current = current[index];
    } else if (current !== null && typeof current === 'object') {
      current = (current as Record<string, unknown>)[segment];
    } else {
      throw new Error(`Cannot read path segment: ${segment}`);
    }
  }
  return current;
}

function isDisallowed(path: string): boolean {
  if (DISALLOWED_PATHS.has(path)) return true;
  for (const disallowed of DISALLOWED_PATHS) {
    if (path.startsWith(`${disallowed}/`)) return true;
  }
  return false;
}

export function validatePatch(operations: JsonPatchOperation[]): void {
  for (const op of operations) {
    if (!op || typeof op !== 'object') {
      throw new Error('Patch operation must be an object');
    }
    if (!['add', 'remove', 'replace', 'test'].includes(op.op)) {
      throw new Error(`Unsupported patch operation: ${op.op}`);
    }
    if (typeof op.path !== 'string' || op.path === '') {
      throw new Error('Patch operation must have a non-empty path');
    }
    if (isDisallowed(op.path)) {
      throw new Error(`Patch path is not allowed: ${op.path}`);
    }
    if ((op.op === 'add' || op.op === 'replace' || op.op === 'test') && !('value' in op)) {
      throw new Error(`Patch operation ${op.op} requires a value`);
    }
  }
}

export function applyPatch<T>(target: T, operations: JsonPatchOperation[]): T {
  validatePatch(operations);

  const result = clone(target);
  for (const op of operations) {
    const segments = parsePointer(op.path);

    if (op.op === 'add' || op.op === 'replace') {
      if (segments.length === 0) {
        return clone(op.value) as T;
      }
      const { parent, key } = getParent(result, segments);
      setValue(parent, key, clone(op.value));
    }

    if (op.op === 'remove') {
      if (segments.length === 0) {
        throw new Error('Cannot remove root document');
      }
      const { parent, key } = getParent(result, segments);
      removeValue(parent, key);
    }

    if (op.op === 'test') {
      const actual = segments.length === 0 ? result : getValue(result, segments);
      if (JSON.stringify(actual) !== JSON.stringify(op.value)) {
        throw new Error(`Patch test failed at ${op.path}`);
      }
    }
  }

  return result;
}
