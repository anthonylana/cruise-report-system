import { describe, expect, it } from 'vitest';
import { parseClientParam } from './clientParam';

describe('parseClientParam', () => {
  it('parses a positive integer', () => {
    expect(parseClientParam('3')).toBe(3);
    expect(parseClientParam('120')).toBe(120);
  });

  it.each([null, '', 'abc', '0', '-1', '1.5', '01', ' 3', '3x', '99999999999999999999'])(
    'treats %j as "All clients"',
    (raw) => {
      expect(parseClientParam(raw)).toBeNull();
    },
  );
});
