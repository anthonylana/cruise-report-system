import { useId } from 'react';
import { isDateRangeInverted } from '../../utils/dateParam';

type Props = {
  /** "YYYY-MM-DD" or null (no lower bound). */
  from: string | null;
  /** "YYYY-MM-DD" or null (no upper bound). */
  to: string | null;
  onFromChange: (date: string | null) => void;
  onToChange: (date: string | null) => void;
  onClear: () => void;
};

const INPUT =
  'rounded border border-gray-300 px-2 py-1.5 aria-[invalid=true]:border-red-500 aria-[invalid=true]:outline-red-500';

// The input reports '' when cleared or half-typed: that means "no filter".
function toDateOrNull(value: string): string | null {
  return value === '' ? null : value;
}

export function DateRangeFilter({ from, to, onFromChange, onToChange, onClear }: Props) {
  const fromId = useId();
  const toId = useId();
  const errorId = useId();

  const inverted = isDateRangeInverted(from, to);
  const hasAny = from !== null || to !== null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={fromId} className="text-sm font-medium">
            From
          </label>
          <input
            id={fromId}
            type="date"
            value={from ?? ''}
            // Picker hint only: the URL can still hold anything, so we validate below too.
            max={to ?? undefined}
            aria-invalid={inverted}
            aria-describedby={inverted ? errorId : undefined}
            onChange={(e) => onFromChange(toDateOrNull(e.target.value))}
            className={INPUT}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={toId} className="text-sm font-medium">
            To
          </label>
          <input
            id={toId}
            type="date"
            value={to ?? ''}
            min={from ?? undefined}
            aria-invalid={inverted}
            aria-describedby={inverted ? errorId : undefined}
            onChange={(e) => onToChange(toDateOrNull(e.target.value))}
            className={INPUT}
          />
        </div>

        {hasAny && (
          <button
            type="button"
            onClick={onClear}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Clear dates
          </button>
        )}
      </div>

      {inverted && (
        <p id={errorId} role="alert" className="text-sm text-red-700">
          "From" must be on or before "To". Events are not loaded until the range is fixed.
        </p>
      )}
    </div>
  );
}
