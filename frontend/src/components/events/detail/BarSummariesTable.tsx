import type { BarSummaryRow } from '../../../types/events';
import { formatMoney } from '../../../utils/format';
import { DetailSection } from './DetailSection';

type Props = {
  rows: BarSummaryRow[];
  /** From the backend (already rounded; null = no bar data), so they match the events list. */
  totals: {
    gross: number | null;
    net: number | null;
    hst: number | null;
    tipOut: number | null;
  };
};

const TH = 'px-3 py-2 text-left font-medium';
const TD = 'px-3 py-2';
const NUM = 'px-3 py-2 text-right tabular-nums';

export function BarSummariesTable({ rows, totals }: Props) {
  return (
    <DetailSection title="Bar sales">
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No bar data for this event.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead className="border-b border-gray-300 bg-slate-50">
              <tr>
                <th className={TH}>Bartender</th>
                <th className={TH}>Deck</th>
                <th className={TH}>Register</th>
                <th className={NUM}>Gross sales</th>
                <th className={NUM}>Net sales</th>
                <th className={NUM}>HST</th>
                <th className={NUM}>Tip out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                // No id in the API row. Index keys are safe: this list is never reordered or edited.
                <tr key={i} className="border-b border-gray-200">
                  <td className={TD}>{r.bartender_name}</td>
                  <td className={TD}>{r.deck_name}</td>
                  <td className={TD}>{r.register_name}</td>
                  <td className={NUM}>{formatMoney(r.gross_sales)}</td>
                  <td className={NUM}>{formatMoney(r.net_sales)}</td>
                  <td className={NUM}>{formatMoney(r.hst)}</td>
                  <td className={NUM}>{formatMoney(r.tip_out)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-300 font-semibold">
              <tr>
                <th scope="row" colSpan={3} className={TH}>
                  Total
                </th>
                <td className={NUM}>{formatMoney(totals.gross)}</td>
                <td className={NUM}>{formatMoney(totals.net)}</td>
                <td className={NUM}>{formatMoney(totals.hst)}</td>
                <td className={NUM}>{formatMoney(totals.tipOut)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </DetailSection>
  );
}
