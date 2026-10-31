import type { LoadError } from '../../hooks/clientsState';
import type { EventListItem, EventSort, EventSortField } from '../../types/events';
import { formatEventDate, formatMoney, formatOptional, formatTime } from '../../utils/format';
import { LoadErrorAlert } from '../LoadErrorAlert';
import { Link } from 'react-router';
import { nextSort, sortDirectionFor } from '../../utils/sortParam';

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
  /** null = default order (newest first). */
  sort: EventSort | null;
  /** Receives the NEXT sort for the clicked header (null = back to default). */
  onSortChange: (next: EventSort | null) => void;
};

const TH = 'px-3 py-2 text-left font-medium';
const TD = 'px-3 py-2';
const NUM = 'px-3 py-2 text-right tabular-nums';
const COLUMNS = [
  { field: 'event_date', label: 'Date', numeric: false },
  { field: 'client_name', label: 'Client', numeric: false },
  { field: 'boarding_time', label: 'Boarding', numeric: false },
  { field: 'function_type', label: 'Function', numeric: false },
  { field: 'guest_count', label: 'Guests', numeric: true },
  { field: 'weather', label: 'Weather', numeric: false },
  { field: 'gross_sales_total', label: 'Gross sales', numeric: true },
  { field: 'tip_out_total', label: 'Tip out', numeric: true },
] as const satisfies readonly { field: EventSortField; label: string; numeric: boolean }[];

type SortableHeaderProps = {
  field: EventSortField;
  label: string;
  numeric: boolean;
  sort: EventSort | null;
  onSortChange: (next: EventSort | null) => void;
};

function SortableHeader({ field, label, numeric, sort, onSortChange }: SortableHeaderProps) {
  const dir = sortDirectionFor(sort, field);
  // Sorted only because nothing else is (default order): show it, but muted.
  const isImplicit = dir !== null && sort === null;

  return (
    <th
      className={numeric ? NUM : TH}
      aria-sort={dir === null ? undefined : dir === 'asc' ? 'ascending' : 'descending'}
    >
      <button
        type="button"
        onClick={() => onSortChange(nextSort(sort, field))}
        className="inline-flex items-center gap-1 font-medium hover:text-blue-700"
      >
        {label}
        {/* Fixed width so the label doesn't shift when the arrow appears. */}
        <span aria-hidden="true" className={`w-3 ${isImplicit ? 'text-slate-400' : ''}`}>
          {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}
        </span>
      </button>
    </th>
  );
}

export function EventsTable({
  status,
  items,
  total,
  page,
  error,
  onRetry,
  onGoToFirstPage,
  sort,
  onSortChange,
}: Props) {
  if (status === 'idle') return null;

  if (status === 'error' && error) {
    return <LoadErrorAlert what="events" error={error} onRetry={onRetry} />;
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

  // Loading with previous rows: keep them visible but dimmed.
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
              {COLUMNS.map((c) => (
                <SortableHeader
                  key={c.field}
                  field={c.field}
                  label={c.label}
                  numeric={c.numeric}
                  sort={sort}
                  onSortChange={onSortChange}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.id} className="border-b border-gray-200">
                <td className={NUM}>{e.id}</td>
                <td className={TD}>
                  <Link to={`/events/${e.id}`} className="text-blue-700 hover:underline">
                    {formatEventDate(e.event_date)}
                  </Link>
                </td>
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
