import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

type Props = ComponentProps<typeof Pagination>;

function renderPagination(overrides: Partial<Props> = {}) {
  const props: Props = {
    page: 2,
    pageSize: 25,
    total: 160,
    disabled: false,
    onPageChange: vi.fn(),
    ...overrides,
  };
  const result = render(<Pagination {...props} />);
  return { props, ...result };
}

function button(name: 'Previous' | 'Next') {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

describe('Pagination', () => {
  it('shows the row range and page count', () => {
    renderPagination();

    expect(screen.getByText('Showing 26–50 of 160')).toBeTruthy();
    expect(screen.getByText('Page 2 of 7')).toBeTruthy();
  });

  it('goes to the previous and next page', () => {
    const { props } = renderPagination();

    fireEvent.click(button('Previous'));
    fireEvent.click(button('Next'));

    expect(props.onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(props.onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('disables Previous on the first page and Next on the last', () => {
    renderPagination({ page: 1, total: 10 });

    expect(button('Previous').disabled).toBe(true);
    expect(button('Next').disabled).toBe(true);
  });

  it('disables both buttons while loading', () => {
    renderPagination({ disabled: true });

    expect(button('Previous').disabled).toBe(true);
    expect(button('Next').disabled).toBe(true);
  });

  it('renders nothing when there are no results', () => {
    const { container } = renderPagination({ page: 1, total: 0 });

    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when the page is past the end', () => {
    const { container } = renderPagination({ page: 9, total: 30 });

    expect(container.innerHTML).toBe('');
  });
});
