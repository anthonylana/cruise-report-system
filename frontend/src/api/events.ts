import type { FetchOutcome } from '../types/api';
import type {
  BarSummaryRow,
  EventDetail,
  EventListItem,
  EventListPage,
  EventOfficer,
  EventQuery,
  FoodReportRow,
  SecurityIncidentRow,
} from '../types/events';
import { getJson } from './client';
import {
  hasStringOrNullFields,
  isBooleanOrNull,
  isNonNegativeInt,
  isNumberOrNull,
  isPositiveInt,
  isRecord,
  isStringOrNull,
} from './validation';

/** Fixed for now (not in the URL). Must stay within the backend's 1..100. */
export const EVENTS_PAGE_SIZE = 25;

// ---------- runtime type guards: list ----------

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

// ---------- runtime type guards: detail ----------

// `satisfies` makes the compiler reject a key that isn't on the interface (e.g. a typo).
const EVENT_TEXT_KEYS = [
  'boarding_time',
  'actual_boarding',
  'actual_departure',
  'cruising_time',
  'extra_time',
  'water_taxi',
  'weather',
  'function_type',
  'damages',
  'dj',
  'dj_feedback',
  'lost_and_found',
  'feedback',
  'food_explain',
  'other',
] as const satisfies readonly (keyof EventDetail)[];

const FOOD_TEXT_KEYS = [
  'client_name',
  'report_type',
  'substitutions',
  'quality',
  'quantity_shortages',
  'presentation',
  'problems_praises',
  'other',
  'items_required',
  'completed_by',
] as const satisfies readonly (keyof FoodReportRow)[];

export function isBarSummaryRow(value: unknown): value is BarSummaryRow {
  return (
    isRecord(value) &&
    typeof value.bartender_name === 'string' &&
    typeof value.deck_name === 'string' &&
    typeof value.register_name === 'string' &&
    isNumberOrNull(value.gross_sales) &&
    isNumberOrNull(value.net_sales) &&
    isNumberOrNull(value.hst) &&
    isNumberOrNull(value.tip_out)
  );
}

export function isEventOfficer(value: unknown): value is EventOfficer {
  return (
    isRecord(value) && typeof value.officer_name === 'string' && typeof value.position === 'string'
  );
}

export function isSecurityIncidentRow(value: unknown): value is SecurityIncidentRow {
  return (
    isRecord(value) &&
    typeof value.guard_name === 'string' &&
    isStringOrNull(value.incident_description)
  );
}

export function isFoodReportRow(value: unknown): value is FoodReportRow {
  return (
    isRecord(value) &&
    (value.client_id === null || isNonNegativeInt(value.client_id)) &&
    hasStringOrNullFields(value, FOOD_TEXT_KEYS)
  );
}

/** One bad nested row rejects the whole event (-> invalid-response). */
export function isEventDetail(value: unknown): value is EventDetail {
  return (
    isRecord(value) &&
    isPositiveInt(value.id) &&
    typeof value.event_date === 'string' &&
    isNonNegativeInt(value.client_id) &&
    typeof value.client_name === 'string' &&
    hasStringOrNullFields(value, EVENT_TEXT_KEYS) &&
    (value.guest_count === null || isNonNegativeInt(value.guest_count)) &&
    isBooleanOrNull(value.floor_plan_followed) &&
    isNumberOrNull(value.gross_sales_total) &&
    isNumberOrNull(value.net_sales_total) &&
    isNumberOrNull(value.hst_total) &&
    isNumberOrNull(value.tip_out_total) &&
    Array.isArray(value.bar_summaries) &&
    value.bar_summaries.every(isBarSummaryRow) &&
    Array.isArray(value.officers) &&
    value.officers.every(isEventOfficer) &&
    Array.isArray(value.security_incidents) &&
    value.security_incidents.every(isSecurityIncidentRow) &&
    Array.isArray(value.food_reports) &&
    value.food_reports.every(isFoodReportRow)
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
  // Both or neither: the backend rejects dir without sort (422).
  if (query.sort !== null) {
    params.set('sort', query.sort.field);
    params.set('dir', query.sort.dir);
  }
  return params.toString();
}

// ---------- the API calls ----------

/** Fetches one page of events (newest first unless query.sort is set). Never throws. */
export function getEvents(
  query: EventQuery,
  signal?: AbortSignal,
): Promise<FetchOutcome<EventListPage>> {
  return getJson(`/api/events?${buildEventsQueryString(query)}`, isEventListPage, { signal });
}

/**
 * Fetches one event with everything attached. Never throws.
 * An unknown id resolves to { kind: 'http-error', httpStatus: 404 }: the caller decides
 * that this means "not found". `id` must already be a valid positive integer (URL parser).
 */
export function getEvent(id: number, signal?: AbortSignal): Promise<FetchOutcome<EventDetail>> {
  return getJson(`/api/events/${id}`, isEventDetail, { signal });
}
