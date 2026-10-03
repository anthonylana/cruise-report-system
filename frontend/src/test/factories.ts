import type { Client } from '../types/clients';
import type {
  BarSummaryRow,
  EventDetail,
  EventListItem,
  EventListPage,
  EventOfficer,
  FoodReportRow,
  SecurityIncidentRow,
} from '../types/events';
import type { ImportResult, UploadOutcome } from '../types/imports';

export function makeFile(name: string, content = 'x'): File {
  return new File([content], name, { type: 'application/vnd.ms-excel' });
}

export function makeResult(overrides: Partial<ImportResult> = {}): ImportResult {
  return {
    filename: 'a.xls',
    status: 'imported',
    event_id: 1,
    event_date: '2026-09-06',
    client_name: 'elite',
    message: null,
    warnings: [],
    ...overrides,
  };
}

const HTTP_BY_STATUS = { imported: 201, skipped: 409, error: 422 } as const;

/** A "result" outcome, as uploadImport returns for a contract body. */
export function makeOutcome(overrides: Partial<ImportResult> = {}): UploadOutcome {
  const body = makeResult(overrides);
  return { kind: 'result', httpStatus: HTTP_BY_STATUS[body.status], body };
}

// A promise we resolve manually, to freeze an upload "in flight" during a test.
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export function makeClient(overrides: Partial<Client> = {}): Client {
  return { id: 1, name: 'Carnival', event_count: 3, ...overrides };
}

export function makeEventListItem(overrides: Partial<EventListItem> = {}): EventListItem {
  return {
    id: 42,
    event_date: '2026-06-14T19:00:00',
    client_id: 3,
    client_name: 'Elite',
    boarding_time: '18:30:00',
    function_type: 'Wedding',
    guest_count: 120,
    weather: 'Clear',
    gross_sales_total: 3450.5,
    tip_out_total: 210,
    ...overrides,
  };
}

export function makeEventListPage(overrides: Partial<EventListPage> = {}): EventListPage {
  return {
    items: [makeEventListItem()],
    total: 1,
    page: 1,
    page_size: 25,
    ...overrides,
  };
}

// ---------- event detail ----------

export function makeBarSummaryRow(overrides: Partial<BarSummaryRow> = {}): BarSummaryRow {
  return {
    bartender_name: 'Sam',
    deck_name: '1st Deck',
    register_name: 'Reg 1',
    gross_sales: 3000,
    net_sales: 2654.87,
    hst: 345.13,
    tip_out: 200,
    ...overrides,
  };
}

export function makeEventOfficer(overrides: Partial<EventOfficer> = {}): EventOfficer {
  return { officer_name: 'J. Smith', position: 'captain', ...overrides };
}

export function makeSecurityIncident(
  overrides: Partial<SecurityIncidentRow> = {},
): SecurityIncidentRow {
  return { guard_name: 'Alex', incident_description: 'Guest refused service', ...overrides };
}

export function makeFoodReport(overrides: Partial<FoodReportRow> = {}): FoodReportRow {
  return {
    client_id: null,
    client_name: null,
    report_type: 'buffet',
    substitutions: null,
    quality: 'Good',
    quantity_shortages: null,
    presentation: null,
    problems_praises: null,
    other: null,
    items_required: null,
    completed_by: 'Maria',
    ...overrides,
  };
}

/** A fully populated event. Lists hold one row each; pass [] to test empty sections. */
export function makeEventDetail(overrides: Partial<EventDetail> = {}): EventDetail {
  return {
    id: 42,
    event_date: '2026-06-14T19:00:00',
    client_id: 3,
    client_name: 'Elite',
    boarding_time: '18:30:00',
    actual_boarding: '18:40:00',
    actual_departure: '19:05:00',
    cruising_time: '03:00:00',
    extra_time: null,
    guest_count: 120,
    water_taxi: null,
    weather: 'Clear',
    function_type: 'Wedding',
    damages: null,
    floor_plan_followed: true,
    dj: null,
    dj_feedback: null,
    lost_and_found: null,
    feedback: 'Great night',
    food_explain: null,
    other: null,
    gross_sales_total: 3000,
    net_sales_total: 2654.87,
    hst_total: 345.13,
    tip_out_total: 200,
    bar_summaries: [makeBarSummaryRow()],
    officers: [makeEventOfficer()],
    security_incidents: [makeSecurityIncident()],
    food_reports: [makeFoodReport()],
    ...overrides,
  };
}
