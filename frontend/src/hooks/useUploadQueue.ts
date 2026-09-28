import { useCallback, useEffect, useReducer, useRef } from 'react';
import { uploadImport } from '../api/imports';
import type { ImportResult, UploadOutcome } from '../types/imports';
import {
  clientErrorResult,
  createQueueItems,
  initialQueueState,
  outcomeToResult,
  queueReducer,
  summarize,
} from './uploadQueue';

export type UploadFn = (file: File, year: number) => Promise<UploadOutcome>;

export function useUploadQueue(upload: UploadFn = uploadImport) {
  const [state, dispatch] = useReducer(queueReducer, initialQueueState);

  // Refs: values that persist across renders but don't cause re-renders.
  const runningRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // Cleanup runs on unmount (e.g. the user navigates to Events mid-batch).
      mountedRef.current = false;
    };
  }, []);

  const start = useCallback(
    async (files: File[], year: number) => {
      // Guard against double clicks; a ref updates instantly, state would not.
      if (runningRef.current || files.length === 0) return;
      runningRef.current = true;

      const items = createQueueItems(files);
      dispatch({ type: 'start', items, year });

      for (const item of items) {
        // Stop sending new files if the user left the page.
        if (!mountedRef.current) break;
        dispatch({ type: 'uploading', id: item.id });

        let result: ImportResult;
        try {
          const outcome = await upload(item.file, year); // one request at a time
          result = outcomeToResult(item.file.name, outcome);
        } catch {
          // uploadImport never throws, but the queue must never get stuck on "uploading".
          result = clientErrorResult(
            item.file.name,
            'Unexpected error in the browser while uploading this file.',
          );
        }

        if (!mountedRef.current) break;
        dispatch({ type: 'finished', id: item.id, result });
      }

      runningRef.current = false;
      if (mountedRef.current) dispatch({ type: 'complete' });
    },
    [upload],
  );

  const reset = useCallback(() => {
    if (runningRef.current) return; // don't wipe results mid-batch
    dispatch({ type: 'reset' });
  }, []);

  return {
    phase: state.phase,
    year: state.year,
    items: state.items,
    summary: summarize(state.items), // cheap to recompute on each render
    isRunning: state.phase === 'running',
    start,
    reset,
  };
}
