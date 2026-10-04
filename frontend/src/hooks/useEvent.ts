import { useCallback, useEffect, useReducer, useState } from 'react';
import { getEvent } from '../api/events';
import type { FetchOutcome } from '../types/api';
import type { EventDetail } from '../types/events';
import {
  eventReducer,
  eventRequestKey,
  initialEventState,
  outcomeToAction,
  selectEventView,
  UNEXPECTED_EVENT_ERROR_MESSAGE,
} from './eventState';

export type FetchEventFn = (id: number, signal?: AbortSignal) => Promise<FetchOutcome<EventDetail>>;

/**
 * Loads one event and re-fetches when `id` changes.
 * Pass `id = null` (invalid URL param) to not fetch at all.
 *
 * `fetchEvent` must have a stable identity (module-level function or a mock created once),
 * same rule as useClients and useEvents.
 */
export function useEvent(id: number | null, fetchEvent: FetchEventFn = getEvent) {
  const [state, dispatch] = useReducer(eventReducer, initialEventState);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (id === null) return;

    const key = eventRequestKey(id, reloadKey);
    const controller = new AbortController();
    const { signal } = controller;

    void fetchEvent(id, signal).then(
      (outcome) => {
        // A newer id, retry or unmount replaced this run: a late response must not win.
        if (signal.aborted) return;
        const action = outcomeToAction(outcome, key);
        if (action) dispatch(action);
      },
      () => {
        // getEvent never throws, but the UI must never get stuck on "loading".
        if (signal.aborted) return;
        dispatch({
          type: 'load-error',
          key,
          error: { message: UNEXPECTED_EVENT_ERROR_MESSAGE, refId: null },
        });
      },
    );

    return () => controller.abort();
  }, [id, reloadKey, fetchEvent]);

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const requestKey = id === null ? null : eventRequestKey(id, reloadKey);
  return { ...selectEventView(state, requestKey), retry };
}
