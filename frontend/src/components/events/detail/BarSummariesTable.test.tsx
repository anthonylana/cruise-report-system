import { render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { makeBarSummaryRow } from '../../../test/factories';
import { BarSummariesTable } from './BarSummariesTable';

type Props = ComponentProps<typeof BarSummariesTable>;

const TOTALS: Props['totals'] = { gross: 3000, net: 2654.87, hst: 345.13, tipOut: 200 };

function cellsOf(row: HTMLElement) {
  return within(row)
    .getAllByRole('cell')
    .map((c) => c.textContent);
}

describe('BarSummariesTable', () => {
  it('renders every column of a row, formatted', () => {
    render(<BarSummariesTable rows={[makeBarSummaryRow()]} totals={TOTALS} />);

    const [, row] = screen.getAllByRole('row'); // [header, row, footer]
    expect(cellsOf(row)).toEqual([
      'Sam',
      '1st Deck',
      'Reg 1',
      '$3,000.00',
      '$2,654.87',
      '$345.13',
      '$200.00',
    ]);
  });

  it('shows the backend totals in the footer', () => {
    render(<BarSummariesTable rows={[makeBarSummaryRow()]} totals={TOTALS} />);

    const footer = screen.getByRole('rowheader', { name: 'Total' }).closest('tr')!;
    expect(cellsOf(footer)).toEqual(['$3,000.00', '$2,654.87', '$345.13', '$200.00']);
  });

  it('shows a dash for null money but $0.00 for a real zero', () => {
    render(
      <BarSummariesTable
        rows={[makeBarSummaryRow({ gross_sales: null, net_sales: null, hst: null, tip_out: 0 })]}
        totals={{ gross: null, net: null, hst: null, tipOut: 0 }}
      />,
    );

    const [, row] = screen.getAllByRole('row');
    expect(cellsOf(row).slice(3)).toEqual(['—', '—', '—', '$0.00']);
  });

  it('shows an empty message and no table without rows', () => {
    render(
      <BarSummariesTable rows={[]} totals={{ gross: null, net: null, hst: null, tipOut: null }} />,
    );

    expect(screen.getByText(/no bar data/i)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
