import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LoadError } from '../hooks/clientsState';
import { LoadErrorAlert } from './LoadErrorAlert';

function renderAlert(error: LoadError) {
  const onRetry = vi.fn();
  render(<LoadErrorAlert what="events" error={error} onRetry={onRetry} />);
  return onRetry;
}

describe('LoadErrorAlert', () => {
  it('shows what failed and the message', () => {
    renderAlert({ message: 'Server error.', refId: null });

    expect(screen.getByRole('alert').textContent).toContain('Could not load events. Server error.');
  });

  it('shows the reference ID when the message does not contain it', () => {
    renderAlert({ message: 'Server error.', refId: 'abcd1234' });

    expect(screen.getByText('Reference: abcd1234')).toBeTruthy();
  });

  it('does not repeat the reference ID already in the message', () => {
    renderAlert({ message: 'Server error: boom (ref: abcd1234)', refId: 'abcd1234' });

    expect(screen.queryByText(/^Reference:/)).toBeNull();
  });

  it('has no reference line without a ref ID', () => {
    renderAlert({ message: 'No response', refId: null });

    expect(screen.queryByText(/^Reference:/)).toBeNull();
  });

  it('calls onRetry when Retry is clicked', () => {
    const onRetry = renderAlert({ message: 'Boom', refId: null });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
