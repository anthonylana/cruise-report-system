import { useId } from 'react';
import type { ClientsStatus, LoadError } from '../../hooks/clientsState';
import type { Client } from '../../types/clients';

// <select> values are strings: '' means "All clients" (null in the app).
const ALL = '';

type Props = {
  /** Selected client id, or null for "All clients". */
  value: number | null;
  onChange: (clientId: number | null) => void;
  clients: Client[];
  status: ClientsStatus;
  error: LoadError | null;
  onRetry: () => void;
};

export function ClientFilter({ value, onChange, clients, status, error, onRetry }: Props) {
  // Unique per instance, so the label still works if the filter appears twice on a page.
  const selectId = useId();

  // A value from the URL (?client=999) may not match any loaded client.
  const isKnown = value === null || clients.some((c) => c.id === value);
  const isEmpty = status === 'ok' && clients.length === 0;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium">
        Client
      </label>
      <select
        id={selectId}
        value={value === null ? ALL : String(value)}
        disabled={status !== 'ok'}
        onChange={(e) => onChange(e.target.value === ALL ? null : Number(e.target.value))}
        className="w-64 rounded border border-gray-300 px-2 py-1.5 disabled:opacity-50"
      >
        <option value={ALL}>All clients</option>
        {!isKnown && (
          // Keeps the select showing the real value instead of silently showing "All clients".
          <option value={String(value)}>
            {status === 'ok' ? `Unknown client (#${value})` : `Client #${value}`}
          </option>
        )}
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.event_count})
          </option>
        ))}
      </select>

      {status === 'loading' && (
        <p role="status" className="text-sm text-slate-500">
          Loading clients…
        </p>
      )}

      {status === 'error' && error && (
        <div role="alert" className="flex flex-col gap-1 text-sm text-red-700">
          <p>Could not load clients. {error.message}</p>
          {error.refId && !error.message.includes(error.refId) && <p>Reference: {error.refId}</p>}
          <button
            type="button"
            onClick={onRetry}
            className="w-fit rounded border border-red-300 px-2 py-1 hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      {isEmpty && (
        <p className="text-sm text-slate-500">No clients yet. Import some files first.</p>
      )}

      {status === 'ok' && !isKnown && (
        <p className="text-sm text-amber-700">
          Client #{value} was not found. Pick another client or "All clients".
        </p>
      )}
    </div>
  );
}
