import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { makeClient, makeEventListItem, makeEventListPage } from '../test/factories';
import EventsPage from './EventsPage';

type Reply = { body: unknown; status?: number };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const CLIENTS = [
  makeClient({ id: 1, name: 'Carnival', event_count: 3 }),
  makeClient({ id: 2, name: 'Elite', event_count: 0 }),
];

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

// Renders the current query string so tests can assert on the URL.
function LocationProbe() {
  return <p data-testid="search">{useLocation().search}</p>;
}

/** Answers each endpoint separately. `events` can be a function of the request's params. */
function renderAt(
  url: string,
  {
    clients = { body: CLIENTS },
    events = { body: makeEventListPage() },
  }: { clients?: Reply; events?: Reply | ((params: URLSearchParams) => Reply) } = {},
) {
  // A fresh Response per call: a body can only be read once.
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const u = new URL(urlOf(input));
    if (u.pathname === '/api/clients') return jsonResponse(clients.body, clients.status);
    if (u.pathname === '/api/events') {
      const reply = typeof events === 'function' ? events(u.searchParams) : events;
      return jsonResponse(reply.body, reply.status);
    }
    throw new Error(`Unexpected fetch: ${u.href}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/events"
          element={
            <>
              <EventsPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return fetchMock;
}

/** Query params of every /api/events request, in order. */
function eventsRequests(fetchMock: ReturnType<typeof renderAt>): URLSearchParams[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(urlOf(input)))
    .filter((u) => u.pathname === '/api/events')
    .map((u) => u.searchParams);
}

function getSelect() {
  return screen.getByRole('combobox', { name: 'Client' }) as HTMLSelectElement;
}

function params() {
  return new URLSearchParams(screen.getByTestId('search').textContent ?? '');
}

describe('EventsPage client filter', () => {
  it('loads clients and selects the one from the URL', async () => {
    renderAt('/events?client=2');

    await screen.findByRole('option', { name: 'Elite (0)' });

    expect(getSelect().value).toBe('2');
    expect(getSelect().disabled).toBe(false);
  });

  it('writes the picked client, resets the page and keeps other params', async () => {
    renderAt('/events?page=2&from=2026-06-01');
    await screen.findByRole('option', { name: 'Carnival (3)' });

    fireEvent.change(getSelect(), { target: { value: '1' } });

    expect(params().get('client')).toBe('1');
    expect(params().get('page')).toBeNull();
    expect(params().get('from')).toBe('2026-06-01');
  });

  it('removes the param when "All clients" is picked', async () => {
    renderAt('/events?client=1');
    await screen.findByRole('option', { name: 'Carnival (3)' });

    fireEvent.change(getSelect(), { target: { value: '' } });

    expect(params().get('client')).toBeNull();
    expect(getSelect().value).toBe('');
  });

  it('treats a malformed param as "All clients"', async () => {
    renderAt('/events?client=abc');
    await screen.findByRole('option', { name: 'Carnival (3)' });

    expect(getSelect().value).toBe('');
  });

  it('shows the clients error with its ref ID', async () => {
    renderAt('/events', {
      clients: { body: { detail: 'Internal server error (ref: abcd1234)' }, status: 500 },
    });

    const message = await screen.findByText(/could not load clients/i);
    expect(message.textContent).toContain('abcd1234');
  });
});

describe('EventsPage events table', () => {
  it('renders the rows from the response', async () => {
    renderAt('/events');

    expect(await screen.findByText('June 14, 2026')).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'Wedding' })).toBeTruthy();
  });

  it('sends the filters and page from the URL', async () => {
    const fetchMock = renderAt('/events?client=3&from=2026-06-01&to=2026-06-30&page=2', {
      events: { body: makeEventListPage({ page: 2, total: 30 }) },
    });
    await screen.findByText('June 14, 2026');

    const [sent] = eventsRequests(fetchMock);
    expect(sent.get('page')).toBe('2');
    expect(sent.get('page_size')).toBe('25');
    expect(sent.get('client_id')).toBe('3');
    expect(sent.get('date_from')).toBe('2026-06-01');
    expect(sent.get('date_to')).toBe('2026-06-30');
  });

  it('ignores malformed page and date params', async () => {
    const fetchMock = renderAt('/events?page=abc&from=2026-02-30');
    await screen.findByText('June 14, 2026');

    const [sent] = eventsRequests(fetchMock);
    expect(sent.get('page') ?? '1').toBe('1');
    expect(sent.has('date_from')).toBe(false);
  });

  it('does not fetch events when the range is inverted', async () => {
    const fetchMock = renderAt('/events?from=2026-07-01&to=2026-06-30');
    await screen.findByRole('option', { name: 'Carnival (3)' });

    expect(screen.getByRole('alert').textContent).toMatch(/must be on or before/i);
    expect(eventsRequests(fetchMock)).toHaveLength(0);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('changing a date resets the page', async () => {
    renderAt('/events?page=2', { events: { body: makeEventListPage({ page: 2, total: 30 }) } });
    await screen.findByText('June 14, 2026');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-06-01' } });

    expect(params().get('from')).toBe('2026-06-01');
    expect(params().get('page')).toBeNull();
  });

  it('goes to the next page and fetches it', async () => {
    const fetchMock = renderAt('/events', {
      events: (p) => ({
        body: makeEventListPage({
          page: Number(p.get('page') ?? '1'),
          total: 60,
          items: [makeEventListItem({ id: Number(p.get('page') ?? '1') })],
        }),
      }),
    });
    await screen.findByText('Page 1 of 3');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(params().get('page')).toBe('2');
    expect(await screen.findByText('Page 2 of 3')).toBeTruthy();
    expect(eventsRequests(fetchMock).at(-1)?.get('page')).toBe('2');
  });

  it('offers to go back when the page is past the end', async () => {
    renderAt('/events?page=9', {
      events: { body: makeEventListPage({ page: 9, total: 30, items: [] }) },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Go to first page' }));

    expect(params().get('page')).toBeNull();
  });

  it('shows the events error and retries', async () => {
    let calls = 0;
    const fetchMock = renderAt('/events', {
      events: () =>
        ++calls === 1
          ? { body: { detail: 'Internal server error (ref: abcd1234)' }, status: 500 }
          : { body: makeEventListPage() },
    });

    const message = await screen.findByText(/could not load events/i);
    expect(message.textContent).toContain('abcd1234');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('June 14, 2026')).toBeTruthy();
    await waitFor(() => expect(eventsRequests(fetchMock)).toHaveLength(2));
  });
});
