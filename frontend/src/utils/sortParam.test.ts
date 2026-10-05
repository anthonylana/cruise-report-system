import { describe, expect, it } from 'vitest';
import type { EventSort, EventSortField } from '../types/events';
import {
  applySortParams,
  DIR_PARAM,
  isEventSortField,
  nextSort,
  parseSortParams,
  sortDirectionFor,
  SORT_PARAM,
} from './sortParam';

const ALL_FIELDS: EventSortField[] = [
  'event_date',
  'client_name',
  'boarding_time',
  'function_type',
  'guest_count',
  'weather',
  'gross_sales_total',
  'tip_out_total',
];

describe('isEventSortField', () => {
  it.each(ALL_FIELDS)('accepts %s', (field) => {
    expect(isEventSortField(field)).toBe(true);
  });

  it.each(['id', 'gross_sales', 'EVENT_DATE', '', 'toString', 'constructor', '__proto__'])(
    'rejects %j',
    (raw) => {
      expect(isEventSortField(raw)).toBe(false);
    },
  );
});

describe('parseSortParams', () => {
  it('parses a valid pair', () => {
    expect(parseSortParams('gross_sales_total', 'desc')).toEqual({
      field: 'gross_sales_total',
      dir: 'desc',
    });
  });

  it.each([
    [null, null],
    ['guest_count', null], // dir is required
    [null, 'asc'], // dir without sort
    ['id', 'asc'], // not in the allow-list
    ['guest_count', 'DESC'], // case-sensitive, like the backend
    ['guest_count', 'up'],
    ['', ''],
  ])('treats sort=%j dir=%j as the default (null)', (rawSort, rawDir) => {
    expect(parseSortParams(rawSort, rawDir)).toBeNull();
  });

  it('normalizes event_date desc (the default order) to null', () => {
    expect(parseSortParams('event_date', 'desc')).toBeNull();
  });

  it('keeps event_date asc', () => {
    expect(parseSortParams('event_date', 'asc')).toEqual({ field: 'event_date', dir: 'asc' });
  });
});

describe('nextSort', () => {
  /** Clicks the same header repeatedly, starting from no sort. */
  function cycle(field: EventSortField, clicks: number): (EventSort | null)[] {
    const states: (EventSort | null)[] = [];
    let current: EventSort | null = null;
    for (let i = 0; i < clicks; i++) {
      current = nextSort(current, field);
      states.push(current);
    }
    return states;
  }

  it.each(['guest_count', 'gross_sales_total', 'tip_out_total'] as const)(
    'numeric %s: desc → asc → off',
    (field) => {
      expect(cycle(field, 3)).toEqual([{ field, dir: 'desc' }, { field, dir: 'asc' }, null]);
    },
  );

  it.each(['client_name', 'boarding_time', 'function_type', 'weather'] as const)(
    'text/time %s: asc → desc → off',
    (field) => {
      expect(cycle(field, 3)).toEqual([{ field, dir: 'asc' }, { field, dir: 'desc' }, null]);
    },
  );

  it('event_date: asc → off (its desc is the default)', () => {
    expect(cycle('event_date', 2)).toEqual([{ field: 'event_date', dir: 'asc' }, null]);
  });

  it('clicking another column starts that column fresh', () => {
    const current: EventSort = { field: 'client_name', dir: 'desc' };
    expect(nextSort(current, 'gross_sales_total')).toEqual({
      field: 'gross_sales_total',
      dir: 'desc',
    });
  });
});

describe('sortDirectionFor', () => {
  it('reports the default order on event_date when there is no sort', () => {
    expect(sortDirectionFor(null, 'event_date')).toBe('desc');
    expect(sortDirectionFor(null, 'guest_count')).toBeNull();
  });

  it('reports only the sorted column', () => {
    const sort: EventSort = { field: 'weather', dir: 'asc' };
    expect(sortDirectionFor(sort, 'weather')).toBe('asc');
    expect(sortDirectionFor(sort, 'event_date')).toBeNull();
  });
});

describe('applySortParams', () => {
  it('sets both keys and keeps other params', () => {
    const params = new URLSearchParams('client=3');
    applySortParams(params, { field: 'tip_out_total', dir: 'desc' });
    expect(params.toString()).toBe('client=3&sort=tip_out_total&dir=desc');
  });

  it('removes both keys for null', () => {
    const params = new URLSearchParams('client=3&sort=weather&dir=asc');
    applySortParams(params, null);
    expect(params.has(SORT_PARAM)).toBe(false);
    expect(params.has(DIR_PARAM)).toBe(false);
    expect(params.get('client')).toBe('3');
  });

  it('round-trips through parseSortParams', () => {
    const sort: EventSort = { field: 'boarding_time', dir: 'desc' };
    const params = new URLSearchParams();
    applySortParams(params, sort);
    expect(parseSortParams(params.get(SORT_PARAM), params.get(DIR_PARAM))).toEqual(sort);
  });
});
