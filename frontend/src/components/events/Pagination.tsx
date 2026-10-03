import { pageInfo } from '../../utils/pagination';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  /** True while a page is loading: prevents double clicks racing ahead. */
  disabled: boolean;
  onPageChange: (page: number) => void;
};

const BUTTON =
  'rounded border border-gray-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent';

export function Pagination({ page, pageSize, total, disabled, onPageChange }: Props) {
  const info = pageInfo(page, pageSize, total);

  // No rows, or past the end: EventsTable already explains it.
  if (info.firstRow === 0) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm">
      <p className="text-slate-600">
        Showing {info.firstRow}–{info.lastRow} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={BUTTON}
          disabled={disabled || !info.hasPrevious}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span className="tabular-nums">
          Page {page} of {info.totalPages}
        </span>
        <button
          type="button"
          className={BUTTON}
          disabled={disabled || !info.hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
