import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { deferred, makeClient } from '../test/factories';
import type { FetchOutcome } from '../types/api';
import type { Client } from '../types/clients';
import { useClients, type FetchClientsFn } from './useClients';

type Outcome = FetchOutcome<Client[]>;

function ok(clients: Client[]): Outcome {
  return { kind: 'ok', data: clients };
}

/** The AbortSignal passed on the nth call (0-based). */
function signalOf(fetchClients: ReturnType<typeof vi.fn<FetchClientsFn>>, call: number) {
  return fetchClients.mock.calls[call][0];
}

describe('useClients', () => {
  it('loads on mount: loading, then ok', async () => {
    const pending = deferred<Outcome>();
    const fetchClients = vi.fn<FetchClientsFn>().mockReturnValue(pending.promise);
    const { result } = renderHook(() => useClients(fetchClients));

    expect(result.current.status).toBe('loading');
    expect(fetchClients).toHaveBeenCalledTimes(1);
    expect(signalOf(fetchClients, 0)).toBeInstanceOf(AbortSignal);

    await act(async () => {
      pending.resolve(ok([makeClient({ name: 'Elite' })]));
    });

    expect(result.current.status).toBe('ok');
    expect(result.current.clients.map((c) => c.name)).toEqual(['Elite']);
    expect(result.current.error).toBeNull();
  });

  it('exposes an http-error with its ref ID', async () => {
    const fetchClients = vi.fn<FetchClientsFn>().mockResolvedValue({
      kind: 'http-error',
      httpStatus: 500,
      message: 'Server error: Internal server error (ref: abcd1234)',
      refId: 'abcd1234',
    });
    const { result } = renderHook(() => useClients(fetchClients));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.refId).toBe('abcd1234');
    expect(result.current.clients).toEqual([]);
  });

  it('turns an unexpected throw into an error instead of loading forever', async () => {
    const fetchClients = vi.fn<FetchClientsFn>().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useClients(fetchClients));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.message).toMatch(/unexpected/i);
  });

  it('ignores an aborted outcome', async () => {
    const pending = deferred<Outcome>();
    const fetchClients = vi.fn<FetchClientsFn>().mockReturnValue(pending.promise);
    const { result } = renderHook(() => useClients(fetchClients));

    await act(async () => {
      pending.resolve({ kind: 'aborted' });
    });

    expect(result.current.status).toBe('loading');
    expect(result.current.error).toBeNull();
  });

  it('retry refetches after an error', async () => {
    const fetchClients = vi
      .fn<FetchClientsFn>()
      .mockResolvedValueOnce({ kind: 'network-error', message: 'No response' })
      .mockResolvedValueOnce(ok([makeClient()]));
    const { result } = renderHook(() => useClients(fetchClients));
    await waitFor(() => expect(result.current.status).toBe('error'));

    act(() => {
      result.current.retry();
    });
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(fetchClients).toHaveBeenCalledTimes(2);
    expect(result.current.clients).toEqual([makeClient()]);
  });

  it('aborts the request on unmount', () => {
    const fetchClients = vi.fn<FetchClientsFn>().mockReturnValue(deferred<Outcome>().promise);
    const { unmount } = renderHook(() => useClients(fetchClients));

    expect(signalOf(fetchClients, 0)?.aborted).toBe(false);
    unmount();
    expect(signalOf(fetchClients, 0)?.aborted).toBe(true);
  });

  it('ignores a stale response that arrives after a newer one', async () => {
    const first = deferred<Outcome>();
    const second = deferred<Outcome>();
    // This fake ignores the signal on purpose: the hook itself must discard stale data.
    const fetchClients = vi
      .fn<FetchClientsFn>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useClients(fetchClients));

    act(() => {
      result.current.retry(); // first request is now stale
    });
    expect(signalOf(fetchClients, 0)?.aborted).toBe(true);

    await act(async () => {
      second.resolve(ok([makeClient({ name: 'Fresh' })]));
    });
    await act(async () => {
      first.resolve(ok([makeClient({ name: 'Stale' })]));
    });

    expect(result.current.clients.map((c) => c.name)).toEqual(['Fresh']);
  });

  it('survives StrictMode: only the latest effect run updates state', async () => {
    // StrictMode may run the effect once or twice (mount → cleanup → mount),
    // depending on the React build. Handle both: one deferred per call.
    const calls: ReturnType<typeof deferred<Outcome>>[] = [];
    const fetchClients = vi.fn<FetchClientsFn>().mockImplementation(() => {
      const d = deferred<Outcome>();
      calls.push(d);
      return d.promise;
    });
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useClients(fetchClients), { wrapper });

    const total = fetchClients.mock.calls.length;
    expect(total).toBeGreaterThanOrEqual(1);
    // Every earlier run was cleaned up; only the last one is still wanted.
    for (let i = 0; i < total - 1; i++) {
      expect(signalOf(fetchClients, i)?.aborted).toBe(true);
    }
    expect(signalOf(fetchClients, total - 1)?.aborted).toBe(false);

    // Worst case: the latest answer lands first, stale ones arrive afterwards.
    await act(async () => {
      calls[total - 1].resolve(ok([makeClient({ name: 'Real' })]));
    });
    await act(async () => {
      calls.slice(0, -1).forEach((d) => d.resolve(ok([makeClient({ name: 'Stale' })])));
    });

    expect(result.current.clients.map((c) => c.name)).toEqual(['Real']);
  });
});
