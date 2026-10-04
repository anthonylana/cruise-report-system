import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { makeEventListItem } from '../../test/factories';
import { EventsTable } from './EventsTable';
import { MemoryRouter } from 'react-router';

type Props = ComponentProps<typeof EventsTable>;

function renderTable(overrides: Partial<Props> = {}) {
  const props: Props = {
    status: 'ok',
    items: [makeEventListItem()],
    total: 1,
    page: 1,
    error: null,
    onRetry: vi.fn(),
    onGoToFirstPage: vi.fn(),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <EventsTable {...props} />
    </MemoryRouter>,
  );
  return props;
}

function bodyRows() {
  // First row is the header.
  return screen.getAllByRole('row').slice(1);
}

describe('EventsTable', () => {
  it('renders every field of a row, formatted', () => {
    renderTable();

    const cells = within(bodyRows()[0])
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(cells).toEqual([
      '42',
      'June 14, 2026',
      'Elite',
      '18:30',
      'Wedding',
      '120',
      'Clear',
      '$3,450.50',
      '$210.00',
    ]);
  });

  it('shows a dash for null values but $0.00 for a real zero', () => {
    renderTable({
      items: [
        makeEventListItem({
          boarding_time: null,
          function_type: null,
          guest_count: null,
          weather: null,
          gross_sales_total: null,
          tip_out_total: 0,
        }),
      ],
    });

    const cells = within(bodyRows()[0])
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(cells.slice(3)).toEqual(['—', '—', '—', '—', '—', '$0.00']);
  });

  it('renders one row per item', () => {
    renderTable({ items: [makeEventListItem({ id: 1 }), makeEventListItem({ id: 2 })], total: 2 });

    expect(bodyRows()).toHaveLength(2);
  });

  it('links each row date to its detail page', () => {
    renderTable({ items: [makeEventListItem({ id: 7 })] });

    const link = screen.getByRole('link', { name: 'June 14, 2026' });
    expect(link.getAttribute('href')).toBe('/events/7');
  });

  it('shows a loading message on first load', () => {
    renderTable({ status: 'loading', items: [] });

    expect(screen.getByRole('status').textContent).toMatch(/loading events/i);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('keeps previous rows visible while the next page loads', () => {
    renderTable({ status: 'loading' });

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');
    expect(bodyRows()).toHaveLength(1);
  });

  it('shows the error with its ref ID and a working retry button, without rows', () => {
    const props = renderTable({
      status: 'error',
      items: [],
      error: { message: 'Server error.', refId: 'abcd1234' },
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Server error.');
    expect(alert.textContent).toContain('abcd1234');
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows an empty message when nothing matches', () => {
    renderTable({ items: [], total: 0 });

    expect(screen.getByText(/no events match/i)).toBeTruthy();
  });

  it('offers to go back when the page is past the end', () => {
    const props = renderTable({ items: [], total: 30, page: 9 });

    expect(screen.getByText(/this page doesn't exist/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Go to first page' }));
    expect(props.onGoToFirstPage).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when idle', () => {
    const { container } = render(
      <EventsTable
        status="idle"
        items={[]}
        total={0}
        page={1}
        error={null}
        onRetry={vi.fn()}
        onGoToFirstPage={vi.fn()}
      />,
    );

    expect(container.innerHTML).toBe('');
  });
});
