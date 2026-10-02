import type { FetchOutcome } from '../types/api';
import type { EventListItem, EventListPage, EventQuery } from '../types/events';
import { getJson } from './client';
import {
  isNonNegativeInt,
  isNumberOrNull,
  isPositiveInt,
  isRecord,
  isStringOrNull,
} from './validation';

/** Fixed for now (not in the URL). Must stay within the backend's 1..100. */
export const EVENTS_PAGE_SIZE = 25;

// ---------- runtime type guards ----------

/**
 * True only if `value` has the shape of the backend's EventListItem.
 * Extra keys are allowed, so the backend can add fields without breaking the UI.
 */
export function isEventListItem(value: unknown): value is EventListItem {
  return (
    isRecord(value) &&
    isNonNegativeInt(value.id) &&
    typeof value.event_date === 'string' &&
    isNonNegativeInt(value.client_id) &&
    typeof value.client_name === 'string' &&
    isStringOrNull(value.boarding_time) &&
    isStringOrNull(value.function_type) &&
    (value.guest_count === null || isNonNegativeInt(value.guest_count)) &&
    isStringOrNull(value.weather) &&
    isNumberOrNull(value.gross_sales_total) &&
    isNumberOrNull(value.tip_out_total)
  );
}

export function isEventListPage(value: unknown): value is EventListPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isEventListItem) &&
    isNonNegativeInt(value.total) &&
    isPositiveInt(value.page) &&
    isPositiveInt(value.page_size)
  );
}

// ---------- query string ----------

/**
 * EventQuery (camelCase) -> "page=1&page_size=25&client_id=3&date_from=...".
 * null filters are omitted entirely (sending "client_id=null" would be a 422).
 * Exported so it can be tested on its own.
 */
export function buildEventsQueryString(query: EventQuery): string {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('page_size', String(query.pageSize));
  if (query.clientId !== null) {
    params.set('client_id', String(query.clientId));
  }
  if (query.dateFrom !== null) {
    params.set('date_from', query.dateFrom);
  }
  if (query.dateTo !== null) {
    params.set('date_to', query.dateTo);
  }
  return params.toString();
}

// ---------- the API call ----------

/** Fetches one page of events, newest first. Never throws. */
export function getEvents(
  query: EventQuery,
  signal?: AbortSignal,
): Promise<FetchOutcome<EventListPage>> {
  return getJson(`/api/events?${buildEventsQueryString(query)}`, isEventListPage, { signal });
}
