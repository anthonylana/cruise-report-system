import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { deferred, makeEventDetail } from '../test/factories';
import type { FetchOutcome } from '../types/api';
import type { EventDetail } from '../types/events';
import { UNEXPECTED_EVENT_ERROR_MESSAGE } from './eventState';
import { useEvent, type FetchEventFn } from './useEvent';

function ok(data: EventDetail): FetchOutcome<EventDetail> {
  return { kind: 'ok', data };
}

type Props = { id: number | null };

function renderUseEvent(fetchEvent: FetchEventFn, id: number | null = 42) {
  const initialProps: Props = { id };
  return renderHook(({ id: current }: Props) => useEvent(current, fetchEvent), { initialProps });
}

describe('useEvent', () => {
  it('fetches the id and exposes the data', async () => {
    const data = makeEventDetail();
    const fetchEvent = vi.fn<FetchEventFn>().mockResolvedValue(ok(data));

    const { result } = renderUseEvent(fetchEvent);

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current).toMatchObject({ status: 'ok', data });
    expect(fetchEvent).toHaveBeenCalledTimes(1);
    expect(fetchEvent.mock.calls[0][0]).toBe(42);
  });

  it('does not fetch when the id is null', () => {
    const fetchEvent = vi.fn<FetchEventFn>();

    const { result } = renderUseEvent(fetchEvent, null);

    expect(result.current.status).toBe('idle');
    expect(fetchEvent).not.toHaveBeenCalled();
  });

  it('reports a 404 as not-found', async () => {
    const fetchEvent = vi.fn<FetchEventFn>().mockResolvedValue({
      kind: 'http-error',
      httpStatus: 404,
      message: 'Request failed: Event not found',
      refId: null,
    });

    const { result } = renderUseEvent(fetchEvent, 999);

    await waitFor(() => expect(result.current.status).toBe('not-found'));
  });

  it('shows loading without the old event when the id changes', async () => {
    const second = deferred<FetchOutcome<EventDetail>>();
    const fetchEvent = vi
      .fn<FetchEventFn>()
      .mockResolvedValueOnce(ok(makeEventDetail({ id: 42 })))
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderUseEvent(fetchEvent);
    await waitFor(() => expect(result.current.status).toBe('ok'));

    rerender({ id: 43 });

    expect(result.current).toEqual({ status: 'loading', retry: expect.any(Function) });
    const next = makeEventDetail({ id: 43 });
    await act(async () => {
      second.resolve(ok(next));
    });
    expect(result.current).toMatchObject({ status: 'ok', data: next });
  });

  it('aborts the previous request and ignores its late response', async () => {
    const first = deferred<FetchOutcome<EventDetail>>();
    const second = deferred<FetchOutcome<EventDetail>>();
    const fetchEvent = vi
      .fn<FetchEventFn>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderUseEvent(fetchEvent);

    rerender({ id: 43 });

    expect(fetchEvent.mock.calls[0][1]?.aborted).toBe(true);
    expect(fetchEvent.mock.calls[1][1]?.aborted).toBe(false);

    const fresh = makeEventDetail({ id: 43 });
    await act(async () => {
      second.resolve(ok(fresh));
    });
    await act(async () => {
      first.resolve(ok(makeEventDetail({ id: 42 }))); // stale, arrives last
    });

    expect(result.current).toMatchObject({ status: 'ok', data: fresh });
  });

  it('shows the error, then refetches on retry()', async () => {
    const data = makeEventDetail();
    const fetchEvent = vi
      .fn<FetchEventFn>()
      .mockResolvedValueOnce({
        kind: 'http-error',
        httpStatus: 500,
        message: 'Server error: boom (ref: abcd1234)',
        refId: 'abcd1234',
      })
      .mockResolvedValueOnce(ok(data));
    const { result } = renderUseEvent(fetchEvent);

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      error: { message: 'Server error: boom (ref: abcd1234)', refId: 'abcd1234' },
    });

    act(() => {
      result.current.retry();
    });

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(fetchEvent).toHaveBeenCalledTimes(2);
  });

  it('shows an error instead of hanging if the fetch function rejects', async () => {
    const fetchEvent = vi.fn<FetchEventFn>().mockRejectedValue(new Error('bug'));

    const { result } = renderUseEvent(fetchEvent);

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      error: { message: UNEXPECTED_EVENT_ERROR_MESSAGE, refId: null },
    });
  });

  it('aborts the request on unmount', () => {
    const fetchEvent = vi
      .fn<FetchEventFn>()
      .mockReturnValue(deferred<FetchOutcome<EventDetail>>().promise);
    const { unmount } = renderUseEvent(fetchEvent);

    unmount();

    expect(fetchEvent.mock.calls[0][1]?.aborted).toBe(true);
  });
});
