import { describe, expect, it } from 'vitest';
import { analyzeCode } from './static-analysis';

describe('analyzeCode', () => {
  it('passes for harmless TypeScript code', () => {
    const code = `
      export function add(a: number, b: number): number {
        return a + b;
      }
    `;
    const result = analyzeCode(code);
    expect(result.ok).toBe(true);
    expect(result.messages).toHaveLength(0);
  });

  it('passes for harmless JavaScript code', () => {
    const result = analyzeCode('console.log("hello");');
    expect(result.ok).toBe(true);
  });

  it('rejects eval', () => {
    const result = analyzeCode("eval('1 + 1');");
    expect(result.ok).toBe(false);
    expect(result.messages.some((m) => m.ruleId === 'no-eval')).toBe(true);
  });

  it('rejects new Function', () => {
    const result = analyzeCode('const f = new Function("x", "return x");');
    expect(result.ok).toBe(false);
    expect(result.messages.some((m) => m.ruleId === 'no-new-func')).toBe(true);
  });

  it('rejects child_process imports', () => {
    const code = "import { exec } from 'child_process';";
    const result = analyzeCode(code);
    expect(result.ok).toBe(false);
    expect(result.messages.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true);
  });

  it('rejects dynamic imports', () => {
    const result = analyzeCode('const m = await import("fs");');
    expect(result.ok).toBe(false);
    expect(result.messages.some((m) => m.message.includes('Dynamic imports'))).toBe(true);
  });

  it('rejects dynamic require', () => {
    const result = analyzeCode('const fs = require("fs");');
    expect(result.ok).toBe(false);
    expect(result.messages.some((m) => m.message.includes('Dynamic require'))).toBe(true);
  });

  it('rejects fetch', () => {
    const result = analyzeCode('fetch("https://example.com");');
    expect(result.ok).toBe(false);
    expect(result.messages.some((m) => m.message.includes('fetch'))).toBe(true);
  });

  it('rejects WebSocket', () => {
    const result = analyzeCode('new WebSocket("wss://example.com");');
    expect(result.ok).toBe(false);
    expect(result.messages.some((m) => m.message.includes('WebSocket'))).toBe(true);
  });

  it('rejects process.env access', () => {
    const result = analyzeCode('const token = process.env.TOKEN;');
    expect(result.ok).toBe(false);
    expect(result.messages.some((m) => m.message.includes('process.env'))).toBe(true);
  });

  it('rejects __proto__ pollution', () => {
    const result = analyzeCode('obj.__proto__.polluted = true;');
    expect(result.ok).toBe(false);
    expect(result.messages.some((m) => m.message.includes('__proto__'))).toBe(true);
  });

  it('rejects constructor tampering', () => {
    const result = analyzeCode('obj.constructor = evil;');
    expect(result.ok).toBe(false);
    expect(result.messages.some((m) => m.message.includes('Constructor tampering'))).toBe(true);
  });
});
