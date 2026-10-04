import type { FetchOutcome } from '../types/api';
import type { EventDetail } from '../types/events';
import type { LoadError } from './clientsState';

/** The result of the most recent request that finished. */
export type SettledEventResult =
  | { kind: 'ok'; data: EventDetail }
  // The backend answered 404: a normal answer, not a failure (no Retry, no ref ID).
  | { kind: 'not-found' }
  | { kind: 'error'; error: LoadError };

export type EventState = {
  /** null until the first request settles. `key` identifies which request it was. */
  settled: { key: string; result: SettledEventResult } | null;
};

export type EventAction =
  | { type: 'load-success'; key: string; data: EventDetail }
  | { type: 'load-not-found'; key: string }
  | { type: 'load-error'; key: string; error: LoadError };

export const initialEventState: EventState = { settled: null };

export const UNEXPECTED_EVENT_ERROR_MESSAGE =
  'Unexpected error in the browser while loading the event.';

/** Identifies one request: same id + same reloadKey -> same string. */
export function eventRequestKey(id: number, reloadKey: number): string {
  return JSON.stringify([id, reloadKey]);
}

export function eventReducer(_state: EventState, action: EventAction): EventState {
  switch (action.type) {
    case 'load-success':
      return { settled: { key: action.key, result: { kind: 'ok', data: action.data } } };
    case 'load-not-found':
      return { settled: { key: action.key, result: { kind: 'not-found' } } };
    case 'load-error':
      return { settled: { key: action.key, result: { kind: 'error', error: action.error } } };
    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
}

/**
 * Maps a FetchOutcome to an action. null for "aborted": we cancelled it ourselves.
 * Only a 404 means "not found". Other HTTP errors (422, 500, ...) are real errors.
 */
export function outcomeToAction(
  outcome: FetchOutcome<EventDetail>,
  key: string,
): EventAction | null {
  switch (outcome.kind) {
    case 'ok':
      return { type: 'load-success', key, data: outcome.data };
    case 'http-error':
      if (outcome.httpStatus === 404) {
        return { type: 'load-not-found', key };
      }
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

/** What the UI renders. */
export type EventView =
  // No valid id (e.g. /events/abc): nothing requested, the page shows its own message.
  | { status: 'idle' }
  // In flight. No previous data on purpose: another event's numbers must never show here.
  | { status: 'loading' }
  | { status: 'ok'; data: EventDetail }
  | { status: 'not-found' }
  | { status: 'error'; error: LoadError };

/** Pure: derives the view from the state and the key of the request we want right now. */
export function selectEventView(state: EventState, requestKey: string | null): EventView {
  if (requestKey === null) {
    return { status: 'idle' };
  }
  const { settled } = state;
  if (settled === null || settled.key !== requestKey) {
    return { status: 'loading' };
  }
  const { result } = settled;
  switch (result.kind) {
    case 'ok':
      return { status: 'ok', data: result.data };
    case 'not-found':
      return { status: 'not-found' };
    case 'error':
      return { status: 'error', error: result.error };
    default: {
      const unhandled: never = result;
      return unhandled;
    }
  }
}
