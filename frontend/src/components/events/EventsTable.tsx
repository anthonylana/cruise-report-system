import type { LoadError } from '../../hooks/clientsState';
import type { EventListItem } from '../../types/events';
import { formatEventDate, formatMoney, formatOptional, formatTime } from '../../utils/format';

type Props = {
  /** 'idle' = not fetching on purpose (e.g. invalid date range): the page explains why. */
  status: 'idle' | 'loading' | 'ok' | 'error';
  items: EventListItem[];
  /** Matching events across all pages (from the response). */
  total: number;
  page: number;
  error: LoadError | null;
  onRetry: () => void;
  onGoToFirstPage: () => void;
};

const TH = 'px-3 py-2 text-left font-medium';
const TD = 'px-3 py-2';
const NUM = 'px-3 py-2 text-right tabular-nums';

export function EventsTable({
  status,
  items,
  total,
  page,
  error,
  onRetry,
  onGoToFirstPage,
}: Props) {
  if (status === 'idle') return null;

  if (status === 'error' && error) {
    return (
      <div role="alert" className="flex flex-col gap-1 text-sm text-red-700">
        <p>Could not load events. {error.message}</p>
        {error.refId && !error.message.includes(error.refId) && <p>Reference: {error.refId}</p>}
        <button
          type="button"
          onClick={onRetry}
          className="w-fit rounded border border-red-300 px-2 py-1 hover:bg-red-50"
        >
          Retry
        </button>
      </div>
    );
  }

  // First load: nothing to keep on screen yet.
  if (status === 'loading' && items.length === 0) {
    return (
      <p role="status" className="text-sm text-slate-500">
        Loading events…
      </p>
    );
  }

  if (status === 'ok' && items.length === 0) {
    // Results exist, just not on this page (e.g. ?page=99 from an old link).
    if (total > 0 && page > 1) {
      return (
        <div className="flex flex-col gap-1 text-sm text-amber-700">
          <p>This page doesn't exist.</p>
          <button
            type="button"
            onClick={onGoToFirstPage}
            className="w-fit rounded border border-amber-300 px-2 py-1 hover:bg-amber-50"
          >
            Go to first page
          </button>
        </div>
      );
    }
    return <p className="text-sm text-slate-500">No events match these filters.</p>;
  }

  // Loading with previous rows: keep them visible but dimmed (option a).
  const isRefreshing = status === 'loading';

  return (
    <div className="flex flex-col gap-1">
      {isRefreshing && (
        <p role="status" className="text-sm text-slate-500">
          Loading events…
        </p>
      )}
      <div className="overflow-x-auto">
        <table
          aria-busy={isRefreshing}
          className={`min-w-full border-collapse text-sm ${isRefreshing ? 'opacity-50' : ''}`}
        >
          <thead className="border-b border-gray-300 bg-slate-50">
            <tr>
              <th className={NUM}>#</th>
              <th className={TH}>Date</th>
              <th className={TH}>Client</th>
              <th className={TH}>Boarding</th>
              <th className={TH}>Function</th>
              <th className={NUM}>Guests</th>
              <th className={TH}>Weather</th>
              <th className={NUM}>Gross sales</th>
              <th className={NUM}>Tip out</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-gray-200">
                <td className={NUM}>{e.id}</td>
                <td className={TD}>{formatEventDate(e.event_date)}</td>
                <td className={TD}>{e.client_name}</td>
                <td className={TD}>{formatTime(e.boarding_time)}</td>
                <td className={TD}>{formatOptional(e.function_type)}</td>
                <td className={NUM}>{formatOptional(e.guest_count)}</td>
                <td className={TD}>{formatOptional(e.weather)}</td>
                <td className={NUM}>{formatMoney(e.gross_sales_total)}</td>
                <td className={NUM}>{formatMoney(e.tip_out_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
