import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeFoodReport } from '../../../test/factories';
import { FoodReportsList } from './FoodReportsList';

function fieldValue(container: HTMLElement, label: string) {
  return within(container).getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;
}

describe('FoodReportsList', () => {
  it('shows one card per report with its fields', () => {
    render(
      <FoodReportsList
        reports={[
          makeFoodReport(),
          makeFoodReport({ report_type: 'plated', client_name: 'Elite', quality: null }),
        ]}
      />,
    );

    const [first, second] = screen.getAllByRole('article');
    expect(within(first).getByRole('heading', { level: 3 }).textContent).toBe('Buffet');
    expect(fieldValue(first, 'Quality')).toBe('Good');
    expect(fieldValue(first, 'Completed by')).toBe('Maria');

    expect(within(second).getByRole('heading', { level: 3 }).textContent).toBe('Plated — Elite');
    expect(fieldValue(second, 'Quality')).toBe('—');
  });

  it('falls back to a generic title when type and client are unknown', () => {
    render(<FoodReportsList reports={[makeFoodReport({ report_type: null })]} />);

    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Food report');
  });

  it('shows an empty message', () => {
    render(<FoodReportsList reports={[]} />);

    expect(screen.getByText(/no food reports recorded/i)).toBeTruthy();
    expect(screen.queryByRole('article')).toBeNull();
  });
});
