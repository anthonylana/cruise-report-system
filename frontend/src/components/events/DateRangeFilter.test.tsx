import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DateRangeFilter } from './DateRangeFilter';

type Props = ComponentProps<typeof DateRangeFilter>;

function renderFilter(overrides: Partial<Props> = {}) {
  const props: Props = {
    from: null,
    to: null,
    onFromChange: vi.fn(),
    onToChange: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
  render(<DateRangeFilter {...props} />);
  return props;
}

function input(label: 'From' | 'To') {
  return screen.getByLabelText(label) as HTMLInputElement;
}

describe('DateRangeFilter', () => {
  it('shows the current dates', () => {
    renderFilter({ from: '2026-06-01', to: '2026-06-30' });

    expect(input('From').value).toBe('2026-06-01');
    expect(input('To').value).toBe('2026-06-30');
  });

  it('shows empty inputs and no clear button when no dates are set', () => {
    renderFilter();

    expect(input('From').value).toBe('');
    expect(input('To').value).toBe('');
    expect(screen.queryByRole('button', { name: 'Clear dates' })).toBeNull();
  });

  it('reports a picked date', () => {
    const props = renderFilter();

    fireEvent.change(input('From'), { target: { value: '2026-06-01' } });
    fireEvent.change(input('To'), { target: { value: '2026-06-30' } });

    expect(props.onFromChange).toHaveBeenCalledWith('2026-06-01');
    expect(props.onToChange).toHaveBeenCalledWith('2026-06-30');
  });

  it('reports null when a date is cleared', () => {
    const props = renderFilter({ from: '2026-06-01' });

    fireEvent.change(input('From'), { target: { value: '' } });

    expect(props.onFromChange).toHaveBeenCalledWith(null);
  });

  it('clears both dates with the button', () => {
    const props = renderFilter({ to: '2026-06-30' });

    fireEvent.click(screen.getByRole('button', { name: 'Clear dates' }));

    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('flags an inverted range', () => {
    renderFilter({ from: '2026-07-01', to: '2026-06-30' });

    expect(screen.getByRole('alert').textContent).toMatch(/must be on or before/i);
    expect(input('From').getAttribute('aria-invalid')).toBe('true');
    expect(input('To').getAttribute('aria-invalid')).toBe('true');
  });

  it('accepts a same-day range', () => {
    renderFilter({ from: '2026-06-14', to: '2026-06-14' });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(input('From').getAttribute('aria-invalid')).toBe('false');
  });
});
