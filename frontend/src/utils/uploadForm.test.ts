import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES, MIN_YEAR } from '../api/imports';
import { makeFile } from '../test/factories';
import { rejectionReason, validateFiles, yearOptions } from './uploadForm';

function withSize(file: File, size: number): File {
  // Avoids allocating 10 MB in a test.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('rejectionReason', () => {
  it('accepts .xls regardless of case', () => {
    expect(rejectionReason(makeFile('a.xls'))).toBeNull();
    expect(rejectionReason(makeFile('B.XLS'))).toBeNull();
  });

  it('explains that .xlsx is not supported', () => {
    expect(rejectionReason(makeFile('a.xlsx'))).toMatch(/97-2003/);
  });

  it('rejects other extensions', () => {
    expect(rejectionReason(makeFile('notes.txt'))).toBe('Not an .xls file.');
  });

  it('rejects empty and oversized files', () => {
    expect(rejectionReason(makeFile('empty.xls', ''))).toMatch(/empty/i);
    expect(rejectionReason(withSize(makeFile('big.xls'), MAX_UPLOAD_BYTES + 1))).toMatch(/MB/);
  });
});

describe('validateFiles', () => {
  it('splits files into accepted and rejected', () => {
    const good = makeFile('a.xls');
    const { accepted, rejected } = validateFiles([good, makeFile('b.pdf')]);

    expect(accepted).toEqual([good]);
    expect(rejected).toEqual([{ name: 'b.pdf', reason: 'Not an .xls file.' }]);
  });
});

describe('yearOptions', () => {
  it('goes from next year down to MIN_YEAR', () => {
    const years = yearOptions(2026);

    expect(years[0]).toBe(2027);
    expect(years.at(-1)).toBe(MIN_YEAR);
    expect(years).toHaveLength(2027 - MIN_YEAR + 1);
  });
});
