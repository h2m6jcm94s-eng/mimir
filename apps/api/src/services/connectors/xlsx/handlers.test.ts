import { describe, expect, it } from 'vitest';
import * as xlsx from 'xlsx';
import { parseXlsxBase64 } from './handlers';

describe('parseXlsxBase64', () => {
  it('reads rows from a base64-encoded workbook', () => {
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.aoa_to_sheet([
      ['Name', 'Age'],
      ['Alice', 30],
      ['Bob', 25],
    ]);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'People');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const base64 = Buffer.from(buffer).toString('base64');

    const result = parseXlsxBase64(base64);

    expect(result.sheetName).toBe('People');
    expect(result.rows).toEqual([
      { index: 1, data: { Name: 'Alice', Age: 30 } },
      { index: 2, data: { Name: 'Bob', Age: 25 } },
    ]);
  });

  it('selects an explicit sheet by name', () => {
    const workbook = xlsx.utils.book_new();
    const first = xlsx.utils.aoa_to_sheet([['A']]);
    const second = xlsx.utils.aoa_to_sheet([['Name'], ['Carol']]);
    xlsx.utils.book_append_sheet(workbook, first, 'First');
    xlsx.utils.book_append_sheet(workbook, second, 'Second');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const base64 = Buffer.from(buffer).toString('base64');

    const result = parseXlsxBase64(base64, 'Second');

    expect(result.sheetName).toBe('Second');
    expect(result.rows).toEqual([{ index: 1, data: { Name: 'Carol' } }]);
  });
});
