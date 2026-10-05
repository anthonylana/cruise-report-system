import type { FetchOutcome } from '../types/api';
import type { EventListPage, EventQuery } from '../types/events';
import type { LoadError } from './clientsState';

/** The result of the most recent request that finished (success or failure). */
export type SettledResult =
  { kind: 'ok'; data: EventListPage } | { kind: 'error'; error: LoadError };

export type EventsState = {
  /** null until the first request settles. `key` identifies which request it was. */
  settled: { key: string; result: SettledResult } | null;
};

export type EventsAction =
  | { type: 'load-success'; key: string; data: EventListPage }
  | { type: 'load-error'; key: string; error: LoadError };

export const initialEventsState: EventsState = { settled: null };

export const UNEXPECTED_EVENTS_ERROR_MESSAGE =
  'Unexpected error in the browser while loading events.';

/**
 * Identifies one request: same query + same reloadKey -> same string.
 * Strings compare by value, so this is safe to compare across renders.
 */
export function eventsRequestKey(query: EventQuery, reloadKey: number): string {
  return JSON.stringify([
    query.page,
    query.pageSize,
    query.clientId,
    query.dateFrom,
    query.dateTo,
    // Flattened (not the object): field order in an object literal would otherwise matter.
    query.sort?.field ?? null,
    query.sort?.dir ?? null,
    reloadKey,
  ]);
}

export function eventsReducer(_state: EventsState, action: EventsAction): EventsState {
  switch (action.type) {
    case 'load-success':
      return { settled: { key: action.key, result: { kind: 'ok', data: action.data } } };
    case 'load-error':
      // The error replaces the data: never show stale rows under an error message.
      return { settled: { key: action.key, result: { kind: 'error', error: action.error } } };
    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
}

/** Maps a FetchOutcome to an action. null for "aborted": we cancelled it ourselves. */
export function outcomeToAction(
  outcome: FetchOutcome<EventListPage>,
  key: string,
): EventsAction | null {
  switch (outcome.kind) {
    case 'ok':
      return { type: 'load-success', key, data: outcome.data };
    case 'http-error':
      return {
        type: 'load-error',
        key,
        error: { message: outcome.message, refId: outcome.refId },
      };
    case 'invalid-response':
    case 'network-error':
      return { type: 'load-error', key, error: { message: outcome.message, refId: null } };
    case 'aborted':
      return null;
    default: {
      const unhandled: never = outcome;
      return unhandled;
    }
  }
}

/** What the UI renders. A discriminated union, so `data` is non-null exactly when it must be. */
export type EventsView =
  // No query (e.g. from > to): nothing requested, the page shows its own message.
  | { status: 'idle' }
  // Request in flight. `data` is the previous page's rows (kept to avoid a layout jump), or null.
  | { status: 'loading'; data: EventListPage | null }
  | { status: 'ok'; data: EventListPage }
  | { status: 'error'; error: LoadError };

/** Pure: derives the view from the state and the key of the request we want right now. */
export function selectEventsView(state: EventsState, requestKey: string | null): EventsView {
  if (requestKey === null) {
    return { status: 'idle' };
  }
  const { settled } = state;
  if (settled === null || settled.key !== requestKey) {
    const previous = settled?.result.kind === 'ok' ? settled.result.data : null;
    return { status: 'loading', data: previous };
  }
  return settled.result.kind === 'ok'
    ? { status: 'ok', data: settled.result.data }
    : { status: 'error', error: settled.result.error };
}
