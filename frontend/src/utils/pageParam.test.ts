import { describe, expect, it } from 'vitest';
import { parsePageParam } from './pageParam';

describe('parsePageParam', () => {
  it('accepts positive whole numbers', () => {
    expect(parsePageParam('1')).toBe(1);
    expect(parsePageParam('42')).toBe(42);
  });

  it.each([null, '', 'abc', '0', '-1', '1.5', '02', ' 2', '99999999999999999999'])(
    'falls back to 1 for %j',
    (raw) => {
      expect(parsePageParam(raw)).toBe(1);
    },
  );
});
