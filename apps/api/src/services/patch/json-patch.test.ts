import { describe, expect, it } from 'vitest';
import { applyPatch, validatePatch } from './json-patch';

describe('json-patch', () => {
  it('adds a key to an object', () => {
    const result = applyPatch({ a: 1 }, [{ op: 'add', path: '/b', value: 2 }]);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('replaces an existing value', () => {
    const result = applyPatch({ a: 1 }, [{ op: 'replace', path: '/a', value: 2 }]);
    expect(result).toEqual({ a: 2 });
  });

  it('removes a key', () => {
    const result = applyPatch({ a: 1, b: 2 }, [{ op: 'remove', path: '/a' }]);
    expect(result).toEqual({ b: 2 });
  });

  it('supports nested paths', () => {
    const result = applyPatch({ root: { child: 'before' } }, [
      { op: 'replace', path: '/root/child', value: 'after' },
    ]);
    expect(result).toEqual({ root: { child: 'after' } });
  });

  it('does not mutate the target', () => {
    const target = { a: 1 };
    const result = applyPatch(target, [{ op: 'add', path: '/b', value: 2 }]);
    expect(target).toEqual({ a: 1 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('rejects unsupported move/copy operations', () => {
    expect(() => validatePatch([{ op: 'move', path: '/a', from: '/b' }])).toThrow('Unsupported');
  });

  it('rejects patches on disallowed paths', () => {
    expect(() => validatePatch([{ op: 'replace', path: '/tier', value: 2 }])).toThrow(
      'not allowed'
    );
  });

  it('passes test operations', () => {
    const result = applyPatch({ a: 1 }, [{ op: 'test', path: '/a', value: 1 }]);
    expect(result).toEqual({ a: 1 });
  });

  it('fails test operations when values differ', () => {
    expect(() => applyPatch({ a: 1 }, [{ op: 'test', path: '/a', value: 2 }])).toThrow(
      'test failed'
    );
  });
});
