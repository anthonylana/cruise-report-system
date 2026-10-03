// Mirrors backend/app/schemas/events.py (EventListItem, EventListPage).
// Field names stay snake_case to match the wire format (same as Client.event_count).

/** One row of the events table. */
export interface EventListItem {
  id: number;
  /** Naive ISO datetime from the backend, e.g. "2026-06-14T19:00:00". Kept as a string. */
  event_date: string;
  client_id: number;
  client_name: string;
  /** "HH:MM:SS", or null if not recorded. */
  boarding_time: string | null;
  function_type: string | null;
  guest_count: number | null;
  weather: string | null;
  /** Rounded to 2 decimals. null = no bar data (different from a real 0). */
  gross_sales_total: number | null;
  /** Rounded to 2 decimals. null = no bar data (different from a real 0). */
  tip_out_total: number | null;
}

/** Paginated envelope returned by GET /api/events. */
export interface EventListPage {
  items: EventListItem[];
  /** Events matching the filters across all pages. */
  total: number;
  page: number;
  page_size: number;
}

/**
 * What the frontend asks for (camelCase: it's our own shape, not the wire format).
 * null filters are omitted from the request so the backend applies no filter.
 * Dates are "YYYY-MM-DD" and are expected to be validated already (URL parsers).
 */
export interface EventQuery {
  page: number;
  pageSize: number;
  clientId: number | null;
  dateFrom: string | null;
  dateTo: string | null;
}
