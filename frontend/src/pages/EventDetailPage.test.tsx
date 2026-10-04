import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { makeEventDetail } from '../test/factories';
import EventDetailPage from './EventDetailPage';

type Reply = { body: unknown; status?: number };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

// Renders the current path so tests can assert on navigation.
function LocationProbe() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

/** `reply` is called once per request, so tests can change the answer between calls. */
function renderAt(url: string, reply: () => Reply = () => ({ body: makeEventDetail() })) {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const u = new URL(urlOf(input));
    if (/^\/api\/events\/\d+$/.test(u.pathname)) {
      const r = reply();
      return jsonResponse(r.body, r.status);
    }
    throw new Error(`Unexpected fetch: ${u.href}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/events" element={<p>Events list</p>} />
        <Route path="/events/:id" element={<EventDetailPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
  return fetchMock;
}

function requestedPaths(fetchMock: ReturnType<typeof renderAt>): string[] {
  return fetchMock.mock.calls.map(([input]) => new URL(urlOf(input)).pathname);
}

describe('EventDetailPage', () => {
  it('fetches the event from the URL and renders it', async () => {
    const fetchMock = renderAt('/events/42');

    expect(screen.getByRole('status').textContent).toMatch(/loading event/i);
    expect(await screen.findByText('Great night')).toBeTruthy();
    expect(requestedPaths(fetchMock)).toEqual(['/api/events/42']);
  });

  it('shows "Event not found" on a 404, without Retry', async () => {
    renderAt('/events/42', () => ({ body: { detail: 'Event not found' }, status: 404 }));

    expect(await screen.findByRole('heading', { name: 'Event not found' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('does not fetch for a malformed id', () => {
    const fetchMock = renderAt('/events/abc');

    expect(screen.getByRole('heading', { name: 'Event not found' })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the error with its ref ID and retries', async () => {
    let calls = 0;
    const fetchMock = renderAt('/events/42', () =>
      ++calls === 1
        ? { body: { detail: 'Internal server error (ref: abcd1234)' }, status: 500 }
        : { body: makeEventDetail() },
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not load the event/i);
    expect(alert.textContent).toContain('abcd1234');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Great night')).toBeTruthy();
    expect(requestedPaths(fetchMock)).toHaveLength(2);
  });

  it('links back to the events list', async () => {
    renderAt('/events/42');
    await screen.findByText('Great night');

    fireEvent.click(screen.getByRole('link', { name: /back to events/i }));

    expect(screen.getByTestId('path').textContent).toBe('/events');
  });
});
