import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { makeClient } from '../test/factories';
import EventsPage from './EventsPage';

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

// Renders the current query string so tests can assert on the URL.
function LocationProbe() {
  return <p data-testid="search">{useLocation().search}</p>;
}

function renderAt(url: string, body: unknown = CLIENTS, status = 200) {
  // A fresh Response per call: a body can only be read once.
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => jsonResponse(body, status));
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

function getSelect() {
  return screen.getByRole('combobox', { name: 'Client' }) as HTMLSelectElement;
}

function search() {
  return screen.getByTestId('search').textContent;
}

describe('EventsPage client filter', () => {
  it('loads clients and selects the one from the URL', async () => {
    const fetchMock = renderAt('/events?client=2');

    await screen.findByRole('option', { name: 'Elite (0)' });

    expect(getSelect().value).toBe('2');
    expect(getSelect().disabled).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('writes the picked client to the URL and keeps other params', async () => {
    renderAt('/events?page=2');
    await screen.findByRole('option', { name: 'Carnival (3)' });

    fireEvent.change(getSelect(), { target: { value: '1' } });

    const params = new URLSearchParams(search() ?? '');
    expect(params.get('client')).toBe('1');
    expect(params.get('page')).toBe('2');
    expect(getSelect().value).toBe('1');
  });

  it('removes the param when "All clients" is picked', async () => {
    renderAt('/events?client=1');
    await screen.findByRole('option', { name: 'Carnival (3)' });

    fireEvent.change(getSelect(), { target: { value: '' } });

    expect(search()).toBe('');
    expect(getSelect().value).toBe('');
  });

  it('treats a malformed param as "All clients"', async () => {
    renderAt('/events?client=abc');
    await screen.findByRole('option', { name: 'Carnival (3)' });

    expect(getSelect().value).toBe('');
  });

  it('shows the error state when the request fails', async () => {
    renderAt('/events', { detail: 'Internal server error (ref: abcd1234)' }, 500);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('abcd1234');
  });
});
