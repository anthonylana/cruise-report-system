import type { EventSort, EventSortField, SortDirection } from '../types/events';

/** Query-string keys, e.g. /events?sort=gross_sales_total&dir=desc */
export const SORT_PARAM = 'sort';
export const DIR_PARAM = 'dir';

/**
 * Direction of the FIRST click on each column: numbers start biggest-first,
 * text and times start A→Z / earliest-first.
 *
 * Record<EventSortField, …> doubles as the allow-list: the compiler rejects a
 * missing or unknown field, so this can't drift from the EventSortField union.
 */
const FIRST_DIRECTION: Record<EventSortField, SortDirection> = {
  event_date: 'asc', // desc is already the default order, so asc is the only new view
  client_name: 'asc',
  boarding_time: 'asc',
  function_type: 'asc',
  guest_count: 'desc',
  weather: 'asc',
  gross_sales_total: 'desc',
  tip_out_total: 'desc',
};

/** The order the backend uses when no sort is sent. */
const DEFAULT_SORT: EventSort = { field: 'event_date', dir: 'desc' };

export function isEventSortField(raw: string): raw is EventSortField {
  // hasOwnProperty, not `in`: "toString" in {} is true (inherited from the prototype).
  return Object.prototype.hasOwnProperty.call(FIRST_DIRECTION, raw);
}

function isSortDirection(raw: string): raw is SortDirection {
  return raw === 'asc' || raw === 'desc';
}

/** The default order spelled out (event_date desc) becomes null: one URL per ordering. */
function normalize(sort: EventSort): EventSort | null {
  return sort.field === DEFAULT_SORT.field && sort.dir === DEFAULT_SORT.dir ? null : sort;
}

/**
 * Turns raw ?sort= and ?dir= into a sort. Anything invalid means the default order (null):
 * unknown field, missing dir, wrong case ("DESC"). Never throws.
 */
export function parseSortParams(rawSort: string | null, rawDir: string | null): EventSort | null {
  if (rawSort === null || rawDir === null) return null;
  if (!isEventSortField(rawSort) || !isSortDirection(rawDir)) return null;
  return normalize({ field: rawSort, dir: rawDir });
}

/**
 * The click cycle for one header: first direction → opposite → off (null).
 * Clicking a different column starts that column's cycle from the beginning.
 * event_date: asc → off, because its "opposite" (desc) IS the default order.
 */
export function nextSort(current: EventSort | null, field: EventSortField): EventSort | null {
  const first = FIRST_DIRECTION[field];
  if (current === null || current.field !== field) {
    return { field, dir: first };
  }
  if (current.dir === first) {
    return normalize({ field, dir: first === 'asc' ? 'desc' : 'asc' });
  }
  return null;
}

/**
 * The direction a column is REALLY sorted in, for aria-sort and the indicator.
 * With no explicit sort, event_date is still sorted descending: we say so.
 */
export function sortDirectionFor(
  sort: EventSort | null,
  field: EventSortField,
): SortDirection | null {
  const effective = sort ?? DEFAULT_SORT;
  return effective.field === field ? effective.dir : null;
}

/** Writes the sort into URL params: both keys, or neither (backend: dir requires sort). */
export function applySortParams(params: URLSearchParams, sort: EventSort | null): void {
  if (sort === null) {
    params.delete(SORT_PARAM);
    params.delete(DIR_PARAM);
  } else {
    params.set(SORT_PARAM, sort.field);
    params.set(DIR_PARAM, sort.dir);
  }
}
