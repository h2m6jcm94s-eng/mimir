import * as tsParser from '@typescript-eslint/parser';
import { Linter } from 'eslint';

export interface StaticAnalysisMessage {
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  ruleId: string | undefined;
}

export interface StaticAnalysisResult {
  ok: boolean;
  messages: StaticAnalysisMessage[];
}

const bannedSystemPaths = [
  'child_process',
  'fs',
  'fs/promises',
  'net',
  'http',
  'https',
  'os',
  'cluster',
  'dgram',
  'dns',
  'repl',
  'tls',
  'vm',
  'worker_threads',
];

const securityRules: Linter.RulesRecord = {
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-restricted-globals': [
    'error',
    { name: 'process', message: 'Untrusted code should not access process' },
  ],
  'no-restricted-imports': [
    'error',
    {
      paths: bannedSystemPaths,
      patterns: [
        {
          group: [
            'child_process/*',
            'fs/*',
            'node:child_process',
            'node:fs',
            'node:net',
            'node:http',
            'node:https',
            'node:os',
            'node:vm',
            'node:worker_threads',
          ],
          message: 'Untrusted code should not import system modules',
        },
      ],
    },
  ],
  'no-restricted-modules': ['error', ...bannedSystemPaths],
  'no-restricted-syntax': [
    'error',
    {
      selector: 'ImportExpression',
      message: 'Dynamic imports are not allowed in sandboxed code',
    },
    {
      selector: "CallExpression[callee.name='require']",
      message: 'Dynamic require is not allowed in sandboxed code',
    },
    {
      selector: "CallExpression[callee.name='fetch']",
      message: 'Network egress via fetch is not allowed in sandboxed code',
    },
    {
      selector: "NewExpression[callee.name='XMLHttpRequest']",
      message: 'Network egress via XMLHttpRequest is not allowed in sandboxed code',
    },
    {
      selector: "NewExpression[callee.name='WebSocket']",
      message: 'Network egress via WebSocket is not allowed in sandboxed code',
    },
    {
      selector: "NewExpression[callee.name='Worker']",
      message: 'Web Workers are not allowed in sandboxed code',
    },
    {
      selector: "CallExpression[callee.name='importScripts']",
      message: 'importScripts is not allowed in sandboxed code',
    },
    {
      selector: "MemberExpression[object.name='process'][property.name='env']",
      message: 'Access to process.env is not allowed in sandboxed code',
    },
    {
      selector: "Identifier[name='__proto__']",
      message: 'Prototype pollution via __proto__ is not allowed',
    },
    {
      selector: "AssignmentExpression[left.property.name='__proto__']",
      message: 'Prototype pollution via __proto__ assignment is not allowed',
    },
    {
      selector: "AssignmentExpression[left.property.name='constructor']",
      message: 'Constructor tampering is not allowed in sandboxed code',
    },
  ],
};

export function analyzeCode(code: string): StaticAnalysisResult {
  const linter = new Linter();
  linter.defineParser('@typescript-eslint/parser', tsParser as unknown as Linter.ParserModule);
  const config: Linter.Config = {
    parser: '@typescript-eslint/parser',
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: securityRules,
  };
  const messages = linter.verify(code, config, { filename: 'sandbox.ts' });

  const normalized: StaticAnalysisMessage[] = messages.map((m) => ({
    line: m.line,
    column: m.column,
    severity: m.severity === 2 ? 'error' : 'warning',
    message: m.message,
    ruleId: m.ruleId ?? undefined,
  }));

  return {
    ok: !normalized.some((m) => m.severity === 'error'),
    messages: normalized,
  };
}
