import { useCallback, useEffect, useReducer, useState } from 'react';
import { getEvents } from '../api/events';
import type { FetchOutcome } from '../types/api';
import type { EventListPage, EventQuery } from '../types/events';
import {
  eventsReducer,
  eventsRequestKey,
  initialEventsState,
  outcomeToAction,
  selectEventsView,
  UNEXPECTED_EVENTS_ERROR_MESSAGE,
} from './eventsState';

export type FetchEventsFn = (
  query: EventQuery,
  signal?: AbortSignal,
) => Promise<FetchOutcome<EventListPage>>;

// Placeholder values when query is null. Never sent: the effect bails out when !enabled.
const DISABLED_QUERY: EventQuery = {
  page: 1,
  pageSize: 1,
  clientId: null,
  dateFrom: null,
  dateTo: null,
  sort: null,
};

/**
 * Loads one page of events and re-fetches whenever the query changes.
 * Pass `query = null` to not fetch at all (e.g. invalid date range).
 *
 * `fetchEvents` must have a stable identity (module-level function or a mock created once),
 * same rule as useClients. The query itself can be a new object every render: the effect
 * depends on its primitive fields, not on the object.
 */
export function useEvents(query: EventQuery | null, fetchEvents: FetchEventsFn = getEvents) {
  const [state, dispatch] = useReducer(eventsReducer, initialEventsState);
  const [reloadKey, setReloadKey] = useState(0);

  const enabled = query !== null;
  const { page, pageSize, clientId, dateFrom, dateTo, sort } = query ?? DISABLED_QUERY;

  useEffect(() => {
    if (!enabled) return;

    // Rebuilt from primitives so the effect never depends on the caller's object identity.
    const requestQuery: EventQuery = { page, pageSize, clientId, dateFrom, dateTo, sort };
    const key = eventsRequestKey(requestQuery, reloadKey);
    const controller = new AbortController();
    const { signal } = controller;

    void fetchEvents(requestQuery, signal).then(
      (outcome) => {
        // A newer query, retry or unmount replaced this run: a late response must not win.
        if (signal.aborted) return;
        const action = outcomeToAction(outcome, key);
        if (action) dispatch(action);
      },
      () => {
        // getEvents never throws, but the UI must never get stuck on "loading".
        if (signal.aborted) return;
        dispatch({
          type: 'load-error',
          key,
          error: { message: UNEXPECTED_EVENTS_ERROR_MESSAGE, refId: null },
        });
      },
    );

    // Runs before the next effect run (query changed / retry) and on unmount.
    return () => controller.abort();
  }, [enabled, page, pageSize, clientId, dateFrom, dateTo, sort, reloadKey, fetchEvents]);

  const retry = useCallback(() => {
    // A new reloadKey -> a new request key -> the view becomes "loading" automatically.
    setReloadKey((key) => key + 1);
  }, []);

  const requestKey = query === null ? null : eventsRequestKey(query, reloadKey);
  return { ...selectEventsView(state, requestKey), retry };
}
