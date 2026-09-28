import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { makeClient } from '../../test/factories';
import { ClientFilter } from './ClientFilter';

type Props = ComponentProps<typeof ClientFilter>;

const CLIENTS = [
  makeClient({ id: 1, name: 'Carnival', event_count: 3 }),
  makeClient({ id: 2, name: 'Elite', event_count: 0 }),
];

function renderFilter(overrides: Partial<Props> = {}) {
  const props: Props = {
    value: null,
    onChange: vi.fn(),
    clients: CLIENTS,
    status: 'ok',
    error: null,
    onRetry: vi.fn(),
    ...overrides,
  };
  render(<ClientFilter {...props} />);
  return props;
}

function getSelect() {
  return screen.getByRole('combobox', { name: 'Client' }) as HTMLSelectElement;
}

function optionTexts() {
  return screen.getAllByRole('option').map((o) => o.textContent);
}

describe('ClientFilter', () => {
  it('lists "All clients" then each client with its event count', () => {
    renderFilter();

    expect(optionTexts()).toEqual(['All clients', 'Carnival (3)', 'Elite (0)']);
    expect(getSelect().value).toBe('');
    expect(getSelect().disabled).toBe(false);
  });

  it('shows the selected client', () => {
    renderFilter({ value: 2 });

    expect(getSelect().value).toBe('2');
  });

  it('reports a numeric id when a client is picked', () => {
    const props = renderFilter();

    fireEvent.change(getSelect(), { target: { value: '2' } });

    expect(props.onChange).toHaveBeenCalledWith(2);
  });

  it('reports null when "All clients" is picked', () => {
    const props = renderFilter({ value: 1 });

    fireEvent.change(getSelect(), { target: { value: '' } });

    expect(props.onChange).toHaveBeenCalledWith(null);
  });

  it('shows a disabled select while loading', () => {
    renderFilter({ status: 'loading', clients: [] });

    expect(screen.getByRole('status').textContent).toMatch(/loading clients/i);
    expect(getSelect().disabled).toBe(true);
  });

  it('keeps a URL value selected while the list is still loading', () => {
    renderFilter({ status: 'loading', clients: [], value: 7 });

    expect(getSelect().value).toBe('7');
    expect(optionTexts()).toContain('Client #7');
  });

  it('shows the error with its ref ID and a working retry button', () => {
    const props = renderFilter({
      status: 'error',
      clients: [],
      error: { message: 'Server error.', refId: 'abcd1234' },
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Server error.');
    expect(alert.textContent).toContain('abcd1234');
    expect(getSelect().disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not repeat the ref ID when the message already contains it', () => {
    renderFilter({
      status: 'error',
      clients: [],
      error: { message: 'Server error (ref: abcd1234)', refId: 'abcd1234' },
    });

    expect(screen.queryByText(/reference:/i)).toBeNull();
  });

  it('shows a hint when there are no clients', () => {
    renderFilter({ clients: [] });

    expect(screen.getByText(/no clients yet/i)).toBeTruthy();
    expect(optionTexts()).toEqual(['All clients']);
  });

  it('flags an id that matches no client', () => {
    renderFilter({ value: 999 });

    expect(getSelect().value).toBe('999');
    expect(optionTexts()).toContain('Unknown client (#999)');
    expect(screen.getByText(/client #999 was not found/i)).toBeTruthy();
  });
});
