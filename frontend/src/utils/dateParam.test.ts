import { describe, expect, it } from 'vitest';
import { isDateRangeInverted, parseDateParam } from './dateParam';

describe('parseDateParam', () => {
  it('accepts real dates in YYYY-MM-DD format', () => {
    expect(parseDateParam('2026-06-14')).toBe('2026-06-14');
    expect(parseDateParam('2024-02-29')).toBe('2024-02-29'); // leap year
    expect(parseDateParam('2000-02-29')).toBe('2000-02-29'); // divisible by 400
  });

  it.each([
    null,
    '',
    'abc',
    '2026-6-14',
    '2026/06/14',
    '2026-06-14T00:00:00',
    ' 2026-06-14',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-02-29', // not a leap year
    '1900-02-29', // divisible by 100 but not 400
    '0000-01-01',
  ])('rejects %j', (raw) => {
    expect(parseDateParam(raw)).toBeNull();
  });
});

describe('isDateRangeInverted', () => {
  it('is true only when both are set and from is after to', () => {
    expect(isDateRangeInverted('2026-07-01', '2026-06-30')).toBe(true);
    expect(isDateRangeInverted('2026-06-01', '2026-06-30')).toBe(false);
    expect(isDateRangeInverted('2026-06-14', '2026-06-14')).toBe(false); // same day is fine
    expect(isDateRangeInverted('2026-06-14', null)).toBe(false);
    expect(isDateRangeInverted(null, '2026-06-14')).toBe(false);
    expect(isDateRangeInverted(null, null)).toBe(false);
  });
});
