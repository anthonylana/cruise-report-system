import type { LoadError } from '../hooks/clientsState';

type Props = {
  /** What failed, used in the sentence: "Could not load {what}." e.g. "events", "the event". */
  what: string;
  error: LoadError;
  onRetry: () => void;
};

/** Shared error block for every data load: message, server reference ID, Retry button. */
export function LoadErrorAlert({ what, error, onRetry }: Props) {
  // Our JSON 500 message already ends with "(ref: abcd1234)": don't show it twice.
  const showRef = error.refId !== null && !error.message.includes(error.refId);

  return (
    <div role="alert" className="flex flex-col gap-1 text-sm text-red-700">
      <p>
        Could not load {what}. {error.message}
      </p>
      {showRef && <p>Reference: {error.refId}</p>}
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
