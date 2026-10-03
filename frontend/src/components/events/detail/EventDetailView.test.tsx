import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { EventView } from '../../../hooks/eventState';
import { makeEventDetail } from '../../../test/factories';
import { EventDetailView } from './EventDetailView';

function renderView(view: EventView) {
  const onRetry = vi.fn();
  render(
    <MemoryRouter>
      <EventDetailView view={view} onRetry={onRetry} />
    </MemoryRouter>,
  );
  return onRetry;
}

describe('EventDetailView', () => {
  it('shows a loading message', () => {
    renderView({ status: 'loading' });

    expect(screen.getByRole('status').textContent).toMatch(/loading event/i);
  });

  it.each([{ status: 'not-found' } as const, { status: 'idle' } as const])(
    'shows "not found" with a back link and no Retry ($status)',
    (view) => {
      renderView(view);

      expect(screen.getByRole('heading', { name: 'Event not found' })).toBeTruthy();
      expect(screen.getByRole('link', { name: /back to events/i }).getAttribute('href')).toBe(
        '/events',
      );
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    },
  );

  it('shows the error with a working Retry', () => {
    const onRetry = renderView({
      status: 'error',
      error: { message: 'Server error.', refId: 'abcd1234' },
    });

    expect(screen.getByRole('alert').textContent).toContain('Could not load the event.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders every section when loaded', () => {
    renderView({ status: 'ok', data: makeEventDetail() });

    expect(screen.getByRole('heading', { level: 1, name: 'June 14, 2026' })).toBeTruthy();
    for (const name of [
      'Details',
      'Notes',
      'Bar sales',
      'Officers',
      'Security incidents',
      'Food reports',
    ]) {
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
  });

  it('shows the empty messages for an event without attached rows', () => {
    renderView({
      status: 'ok',
      data: makeEventDetail({
        bar_summaries: [],
        officers: [],
        security_incidents: [],
        food_reports: [],
        gross_sales_total: null,
        net_sales_total: null,
        hst_total: null,
        tip_out_total: null,
      }),
    });

    expect(screen.getByText(/no bar data/i)).toBeTruthy();
    expect(screen.getByText(/no officers recorded/i)).toBeTruthy();
    expect(screen.getByText(/no security incidents recorded/i)).toBeTruthy();
    expect(screen.getByText(/no food reports recorded/i)).toBeTruthy();
  });
});
