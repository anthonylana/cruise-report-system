import { describe, expect, it } from 'vitest';
import { formatEventDate, formatMoney, formatOptional, formatTime } from './format';

describe('formatEventDate', () => {
  it('formats a datetime and a plain date', () => {
    expect(formatEventDate('2026-09-06T19:00:00')).toBe('Sept 6, 2026');
    expect(formatEventDate('2026-06-14')).toBe('June 14, 2026');
    expect(formatEventDate('2026-01-01T00:00:00')).toBe('Jan 1, 2026');
  });

  it('returns the input when it is not a date', () => {
    expect(formatEventDate('nope')).toBe('nope');
    expect(formatEventDate('2026-13-01')).toBe('2026-13-01');
  });
});

describe('formatTime', () => {
  it('drops the seconds and handles null', () => {
    expect(formatTime('18:30:00')).toBe('18:30');
    expect(formatTime(null)).toBe('—');
  });
});

describe('formatMoney', () => {
  it('keeps a real 0 different from null', () => {
    expect(formatMoney(3450.5)).toBe('$3,450.50');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(null)).toBe('—');
  });
});

describe('formatOptional', () => {
  it('shows a dash only for null', () => {
    expect(formatOptional(0)).toBe('0');
    expect(formatOptional('Clear')).toBe('Clear');
    expect(formatOptional(null)).toBe('—');
  });
});
