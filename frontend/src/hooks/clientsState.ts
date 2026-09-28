import type { FetchOutcome } from '../types/api';
import type { Client } from '../types/clients';

export type ClientsStatus = 'loading' | 'ok' | 'error';

/** What the UI needs to show an error: our message plus the server ref ID (for JSON 500s). */
export type LoadError = {
  message: string;
  refId: string | null;
};

export type ClientsState = {
  status: ClientsStatus;
  clients: Client[];
  error: LoadError | null;
};

export type ClientsAction =
  | { type: 'load-start' }
  | { type: 'load-success'; clients: Client[] }
  | { type: 'load-error'; error: LoadError };

// Starts as "loading": the hook fetches on mount, so there is no idle state.
export const initialClientsState: ClientsState = {
  status: 'loading',
  clients: [],
  error: null,
};

export const UNEXPECTED_ERROR_MESSAGE = 'Unexpected error in the browser while loading clients.';

export function clientsReducer(state: ClientsState, action: ClientsAction): ClientsState {
  switch (action.type) {
    case 'load-start':
      // Keep the current list so a reload doesn't flash an empty dropdown.
      return { ...state, status: 'loading', error: null };
    case 'load-success':
      return { status: 'ok', clients: action.clients, error: null };
    case 'load-error':
      // Drop the list: never show stale data under an error message.
      return { status: 'error', clients: [], error: action.error };
    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
}

/**
 * Maps a FetchOutcome to the action to dispatch.
 * Returns null for "aborted": we cancelled it ourselves, so there is nothing to show.
 */
export function outcomeToAction(outcome: FetchOutcome<Client[]>): ClientsAction | null {
  switch (outcome.kind) {
    case 'ok':
      return { type: 'load-success', clients: outcome.data };
    case 'http-error':
      return {
        type: 'load-error',
        error: { message: outcome.message, refId: outcome.refId },
      };
    case 'invalid-response':
    case 'network-error':
      return { type: 'load-error', error: { message: outcome.message, refId: null } };
    case 'aborted':
      return null;
    default: {
      const unhandled: never = outcome;
      return unhandled;
    }
  }
}
