import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildEventsQueryString,
  getEvent,
  getEvents,
  isEventDetail,
  isEventListItem,
  isEventListPage,
} from './events';
import {
  makeBarSummaryRow,
  makeEventDetail,
  makeEventListItem,
  makeEventListPage,
  makeFoodReport,
} from '../test/factories';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Shallow copy with one key removed (simulates the backend forgetting a field). */
function without(obj: object, key: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...obj };
  delete copy[key];
  return copy;
}

// ---------- buildEventsQueryString ----------

describe('buildEventsQueryString', () => {
  it('always sends page and page_size, and omits null filters', () => {
    const qs = buildEventsQueryString({
      page: 2,
      pageSize: 25,
      clientId: null,
      dateFrom: null,
      dateTo: null,
      sort: null,
    });
    expect(qs).toBe('page=2&page_size=25');
  });

  it('maps camelCase filters to the snake_case wire names', () => {
    const qs = buildEventsQueryString({
      page: 1,
      pageSize: 25,
      clientId: 3,
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
      sort: null,
    });
    expect(qs).toBe('page=1&page_size=25&client_id=3&date_from=2026-06-01&date_to=2026-06-30');
  });

  it('adds sort and dir when a sort is set', () => {
    const qs = buildEventsQueryString({
      page: 1,
      pageSize: 25,
      clientId: null,
      dateFrom: null,
      dateTo: null,
      sort: { field: 'gross_sales_total', dir: 'desc' },
    });
    expect(qs).toBe('page=1&page_size=25&sort=gross_sales_total&dir=desc');
  });

  it('omits sort and dir for the default order', () => {
    const qs = buildEventsQueryString({
      page: 1,
      pageSize: 25,
      clientId: null,
      dateFrom: null,
      dateTo: null,
      sort: null,
    });
    expect(qs).toBe('page=1&page_size=25');
  });
});

// ---------- list guards ----------

describe('isEventListItem / isEventListPage', () => {
  it('accepts the contract shape, including null optionals', () => {
    expect(isEventListPage(makeEventListPage())).toBe(true);
    expect(
      isEventListItem(
        makeEventListItem({
          boarding_time: null,
          guest_count: null,
          gross_sales_total: null,
          tip_out_total: null,
        }),
      ),
    ).toBe(true);
  });

  it('allows extra keys from the backend', () => {
    expect(isEventListItem({ ...makeEventListItem(), new_field: 'x' })).toBe(true);
  });

  it.each([
    ['money as a string', { gross_sales_total: '3450.50' }],
    ['fractional guest_count', { guest_count: 1.5 }],
    ['null client_name', { client_name: null }],
  ])('rejects %s', (_label, bad) => {
    expect(isEventListItem({ ...makeEventListItem(), ...bad })).toBe(false);
  });

  it('rejects a page containing one bad item', () => {
    const page = { ...makeEventListPage(), items: [makeEventListItem(), { id: 'x' }] };
    expect(isEventListPage(page)).toBe(false);
  });
});

// ---------- detail guard ----------

describe('isEventDetail', () => {
  it('accepts a fully populated event', () => {
    expect(isEventDetail(makeEventDetail())).toBe(true);
  });

  it('accepts empty lists and null totals (an event without bar data)', () => {
    const event = makeEventDetail({
      bar_summaries: [],
      officers: [],
      security_incidents: [],
      food_reports: [],
      gross_sales_total: null,
      net_sales_total: null,
      hst_total: null,
      tip_out_total: null,
      floor_plan_followed: null,
    });
    expect(isEventDetail(event)).toBe(true);
  });

  it('accepts a food report with a known client', () => {
    const event = makeEventDetail({
      food_reports: [makeFoodReport({ client_id: 7, client_name: 'Caterer' })],
    });
    expect(isEventDetail(event)).toBe(true);
  });

  it.each(['bar_summaries', 'officers', 'security_incidents', 'food_reports'])(
    'rejects a null %s list (lists are [] when empty, never null)',
    (key) => {
      expect(isEventDetail({ ...makeEventDetail(), [key]: null })).toBe(false);
    },
  );

  it.each(['weather', 'actual_departure', 'net_sales_total', 'floor_plan_followed'])(
    'rejects a response missing %s',
    (key) => {
      expect(isEventDetail(without(makeEventDetail(), key))).toBe(false);
    },
  );

  it('rejects floor_plan_followed as a string', () => {
    expect(isEventDetail({ ...makeEventDetail(), floor_plan_followed: 'yes' })).toBe(false);
  });

  it('rejects the whole event when one nested row is bad', () => {
    const event = {
      ...makeEventDetail(),
      bar_summaries: [makeBarSummaryRow(), { ...makeBarSummaryRow(), gross_sales: '10' }],
    };
    expect(isEventDetail(event)).toBe(false);
  });

  it('rejects a list item (it lacks the nested sections)', () => {
    expect(isEventDetail(makeEventListItem())).toBe(false);
  });
});

// ---------- getEvents / getEvent (fetch stubbed) ----------

describe('API calls', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it('getEvents requests the list URL with the query string', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeEventListPage()));

    const outcome = await getEvents({
      page: 1,
      pageSize: 25,
      clientId: 3,
      dateFrom: null,
      dateTo: null,
      sort: null,
    });

    expect(outcome).toEqual({ kind: 'ok', data: makeEventListPage() });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(
      /\/api\/events\?page=1&page_size=25&client_id=3$/,
    );
  });

  it('getEvent requests /api/events/{id} and returns the validated detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeEventDetail()));

    const outcome = await getEvent(42);

    expect(outcome).toEqual({ kind: 'ok', data: makeEventDetail() });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/events\/42$/);
  });

  it('getEvent returns a 404 as http-error with the status, for the page to decide', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Event not found' }, 404));

    const outcome = await getEvent(999);

    expect(outcome).toEqual({
      kind: 'http-error',
      httpStatus: 404,
      message: 'Request failed: Event not found',
      refId: null,
    });
  });

  it('getEvent returns invalid-response when the body breaks the contract', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...makeEventDetail(), officers: null }));

    const outcome = await getEvent(42);

    expect(outcome.kind).toBe('invalid-response');
  });

  it('getEvent passes the signal and reports an abort as aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    const outcome = await getEvent(42, controller.signal);

    expect(outcome).toEqual({ kind: 'aborted' });
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });
});
