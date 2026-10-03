import type { Client } from '../types/clients';
import type { EventListItem, EventListPage } from '../types/events';
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
