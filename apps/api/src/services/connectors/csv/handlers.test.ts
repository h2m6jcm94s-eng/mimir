import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvLine } from './handlers';

describe('parseCsvLine', () => {
  it('splits simple comma-separated values', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields containing commas', () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('handles escaped quotes inside quoted fields', () => {
    expect(parseCsvLine('a,"b""c",d')).toEqual(['a', 'b"c', 'd']);
  });
});

describe('parseCsv', () => {
  it('uses the first row as headers', () => {
    const rows = parseCsv('Name,Age\nAlice,30\nBob,25');

    expect(rows).toEqual([
      { index: 1, data: { Name: 'Alice', Age: '30' } },
      { index: 2, data: { Name: 'Bob', Age: '25' } },
    ]);
  });

  it('ignores empty lines', () => {
    const rows = parseCsv('Name\n\nAlice\n');

    expect(rows).toEqual([{ index: 1, data: { Name: 'Alice' } }]);
  });
});
