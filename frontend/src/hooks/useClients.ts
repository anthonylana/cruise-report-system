import { useCallback, useEffect, useReducer, useState } from 'react';
import { getClients } from '../api/clients';
import type { FetchOutcome } from '../types/api';
import type { Client } from '../types/clients';
import {
  clientsReducer,
  initialClientsState,
  outcomeToAction,
  UNEXPECTED_ERROR_MESSAGE,
} from './clientsState';

export type FetchClientsFn = (signal?: AbortSignal) => Promise<FetchOutcome<Client[]>>;

/**
 * Loads the client list on mount, with retry().
 *
 * `fetchClients` must have a stable identity (a module-level function or a mock created
 * once). An inline arrow would be a new function on every render, which re-runs the
 * effect on every render: an infinite request loop.
 */
export function useClients(fetchClients: FetchClientsFn = getClients) {
  const [state, dispatch] = useReducer(clientsReducer, initialClientsState);
  // Bumping this number re-runs the effect below, which is how retry() refetches.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // One controller per effect run: each run owns its own request.
    const controller = new AbortController();
    const { signal } = controller;

    void fetchClients(signal).then(
      (outcome) => {
        // A newer run (retry, unmount, StrictMode remount) replaced this one: ignore it.
        if (signal.aborted) return;
        const action = outcomeToAction(outcome);
        if (action) dispatch(action);
      },
      () => {
        // getClients never throws, but the UI must never get stuck on "loading".
        if (signal.aborted) return;
        dispatch({
          type: 'load-error',
          error: { message: UNEXPECTED_ERROR_MESSAGE, refId: null },
        });
      },
    );

    // Cleanup: runs before the next effect run and on unmount.
    return () => controller.abort();
  }, [fetchClients, reloadKey]);

  const retry = useCallback(() => {
    dispatch({ type: 'load-start' });
    setReloadKey((key) => key + 1);
  }, []);

  return {
    status: state.status,
    clients: state.clients,
    error: state.error,
    retry,
  };
}
