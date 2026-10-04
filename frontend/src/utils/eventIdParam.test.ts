import { describe, expect, it } from 'vitest';
import { parseEventIdParam } from './eventIdParam';

describe('parseEventIdParam', () => {
  it.each([
    ['1', 1],
    ['42', 42],
    ['1000', 1000],
  ])('parses %j as %d', (raw, expected) => {
    expect(parseEventIdParam(raw)).toBe(expected);
  });

  it.each([
    undefined,
    '',
    '0',
    '-1',
    '+1',
    '1.5',
    '12abc',
    'abc',
    ' 12',
    '12 ',
    '007',
    '1e3',
    '0x10',
    '99999999999999999999',
  ])('rejects %j', (raw) => {
    expect(parseEventIdParam(raw)).toBeNull();
  });
});
