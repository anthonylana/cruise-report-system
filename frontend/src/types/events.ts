// Mirrors backend/app/schemas/events.py (EventListItem, EventListPage, EventDetail + rows).
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

// ---------- GET /api/events/{id} ----------

/** One register's bar numbers. Names are flattened in by the backend. Money rounded to cents. */
export interface BarSummaryRow {
  bartender_name: string;
  deck_name: string;
  register_name: string;
  gross_sales: number | null;
  /** gross / 1.13 (HST removed). null when there is no gross. */
  net_sales: number | null;
  hst: number | null;
  tip_out: number | null;
}

export interface EventOfficer {
  officer_name: string;
  /** e.g. "captain", "first_mate", "cruise_director". */
  position: string;
}

export interface SecurityIncidentRow {
  guard_name: string;
  incident_description: string | null;
}

export interface FoodReportRow {
  /** The food client may differ from the event's client, or be unknown (both null). */
  client_id: number | null;
  client_name: string | null;
  /** "buffet" / "plated", or null. */
  report_type: string | null;
  substitutions: string | null;
  quality: string | null;
  quantity_shortages: string | null;
  presentation: string | null;
  problems_praises: string | null;
  other: string | null;
  items_required: string | null;
  completed_by: string | null;
}

/** One event with everything attached. Lists are [] when empty, never null. */
export interface EventDetail {
  id: number;
  event_date: string;
  client_id: number;
  client_name: string;
  /** All time fields are "HH:MM:SS" or null. */
  boarding_time: string | null;
  actual_boarding: string | null;
  actual_departure: string | null;
  cruising_time: string | null;
  extra_time: string | null;
  guest_count: number | null;
  water_taxi: string | null;
  weather: string | null;
  function_type: string | null;
  damages: string | null;
  floor_plan_followed: boolean | null;
  dj: string | null;
  dj_feedback: string | null;
  lost_and_found: string | null;
  feedback: string | null;
  food_explain: string | null;
  other: string | null;
  /** Totals: rounded to cents. null = no bar data (different from a real 0). */
  gross_sales_total: number | null;
  net_sales_total: number | null;
  hst_total: number | null;
  tip_out_total: number | null;
  bar_summaries: BarSummaryRow[];
  officers: EventOfficer[];
  security_incidents: SecurityIncidentRow[];
  food_reports: FoodReportRow[];
}
