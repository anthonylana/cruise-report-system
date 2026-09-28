import { extractRefId } from '../../api/imports';
import type { QueueItem, QueueSummary } from '../../hooks/uploadQueue';
import { StatusBadge } from './StatusBadge';

export function UploadSummary({ summary }: { summary: QueueSummary }) {
  const finished = summary.imported + summary.skipped + summary.error;
  return (
    <p role="status" className="text-sm text-gray-700">
      {finished} of {summary.total} done · {summary.imported} imported · {summary.skipped} skipped ·{' '}
      {summary.error} {summary.error === 1 ? 'error' : 'errors'}
    </p>
  );
}

function ResultRow({ item }: { item: QueueItem }) {
  const result = item.result;
  const refId = extractRefId(result?.message ?? null);

  return (
    <li className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-medium">{item.file.name}</span>
        <StatusBadge status={item.status} />
      </div>

      {result?.status === 'imported' && (
        <p className="text-sm text-gray-600">
          Event #{result.event_id} · {result.event_date ?? 'no date'} ·{' '}
          {result.client_name ?? 'no client'}
        </p>
      )}

      {result?.message && <p className="text-sm text-gray-700">{result.message}</p>}

      {refId && (
        <p className="text-xs text-gray-500">
          Reference: <code className="rounded bg-gray-100 px-1">{refId}</code>
        </p>
      )}

      {result && result.warnings.length > 0 && (
        <ul className="list-inside list-disc text-sm text-amber-700">
          {result.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function UploadResultsList({ items }: { items: QueueItem[] }) {
  return (
    <ul aria-label="Upload results" className="rounded border border-gray-200 bg-white px-4">
      {items.map((item) => (
        <ResultRow key={item.id} item={item} />
      ))}
    </ul>
  );
}
