import { useState, type FormEvent } from 'react';
import { FilePicker } from '../components/upload/FilePicker';
import { UploadResultsList, UploadSummary } from '../components/upload/UploadResults';
import { YearSelect } from '../components/upload/YearSelect';
import { useUploadQueue, type UploadFn } from '../hooks/useUploadQueue';
import { validateFiles, type FileSelection } from '../utils/uploadForm';

type Props = {
  /** Injected in tests; the app uses the real uploadImport (the hook's default). */
  upload?: UploadFn;
};

export default function UploadPage({ upload }: Props) {
  const currentYear = new Date().getFullYear();
  const queue = useUploadQueue(upload);
  const [selection, setSelection] = useState<FileSelection | null>(null);
  const [year, setYear] = useState(currentYear);

  // Derived, not stored.
  const acceptedCount = selection?.accepted.length ?? 0;
  const canSubmit = acceptedCount > 0 && !queue.isRunning;

  function handleSelect(files: File[]) {
    if (queue.phase === 'done') queue.reset(); // a new pick starts a new batch
    setSelection(validateFiles(files));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); // stop the browser's full-page form submit
    if (!selection || !canSubmit) return;
    void queue.start(selection.accepted, year); // the hook drives the rest
    setSelection(null);
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Upload reports</h1>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded border border-gray-200 bg-white p-4"
      >
        <FilePicker disabled={queue.isRunning} onSelect={handleSelect} />
        <YearSelect
          value={year}
          currentYear={currentYear}
          disabled={queue.isRunning}
          onChange={setYear}
        />

        {acceptedCount > 0 && (
          <p className="text-sm text-gray-700">
            {acceptedCount} file{acceptedCount === 1 ? '' : 's'} ready:{' '}
            {selection?.accepted.map((f) => f.name).join(', ')}
          </p>
        )}

        {selection && selection.rejected.length > 0 && (
          <ul aria-label="Rejected files" className="text-sm text-red-700">
            {selection.rejected.map((r, i) => (
              <li key={i}>
                <span className="font-medium">{r.name}</span>: {r.reason}
              </li>
            ))}
          </ul>
        )}

        <div>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {queue.isRunning
              ? 'Uploading…'
              : `Upload ${acceptedCount || ''} file${acceptedCount === 1 ? '' : 's'}`.replace(
                  '  ',
                  ' ',
                )}
          </button>
        </div>
      </form>

      {queue.items.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <UploadSummary summary={queue.summary} />
            {queue.phase === 'done' && (
              <button
                type="button"
                onClick={queue.reset}
                className="text-sm text-gray-600 underline hover:text-gray-900"
              >
                Clear results
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">Batch year: {queue.year}</p>
          <UploadResultsList items={queue.items} />
        </div>
      )}
    </section>
  );
}
