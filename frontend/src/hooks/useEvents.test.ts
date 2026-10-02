import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { deferred, makeEventListItem, makeEventListPage } from '../test/factories';
import type { FetchOutcome } from '../types/api';
import type { EventListPage, EventQuery } from '../types/events';
import { UNEXPECTED_EVENTS_ERROR_MESSAGE } from './eventsState';
import { useEvents, type FetchEventsFn } from './useEvents';

function makeQuery(overrides: Partial<EventQuery> = {}): EventQuery {
  return { page: 1, pageSize: 25, clientId: null, dateFrom: null, dateTo: null, ...overrides };
}

function ok(data: EventListPage): FetchOutcome<EventListPage> {
  return { kind: 'ok', data };
}

type Props = { query: EventQuery | null };

function renderUseEvents(fetchEvents: FetchEventsFn, query: EventQuery | null = makeQuery()) {
  const initialProps: Props = { query };
  return renderHook(({ query: q }: Props) => useEvents(q, fetchEvents), { initialProps });
}

describe('useEvents', () => {
  it('fetches the query and exposes the data', async () => {
    const data = makeEventListPage();
    const fetchEvents = vi.fn<FetchEventsFn>().mockResolvedValue(ok(data));

    const { result } = renderUseEvents(fetchEvents, makeQuery({ clientId: 3 }));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current).toMatchObject({ status: 'ok', data });
    expect(fetchEvents).toHaveBeenCalledTimes(1);
    expect(fetchEvents.mock.calls[0][0]).toEqual(makeQuery({ clientId: 3 }));
  });

  it('does not fetch when the query is null', () => {
    const fetchEvents = vi.fn<FetchEventsFn>();

    const { result } = renderUseEvents(fetchEvents, null);

    expect(result.current.status).toBe('idle');
    expect(fetchEvents).not.toHaveBeenCalled();
  });

  it('does not refetch when re-rendered with an equal query object', async () => {
    const fetchEvents = vi.fn<FetchEventsFn>().mockResolvedValue(ok(makeEventListPage()));
    const { result, rerender } = renderUseEvents(fetchEvents);
    await waitFor(() => expect(result.current.status).toBe('ok'));

    rerender({ query: makeQuery() }); // new object, same values

    expect(fetchEvents).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('ok');
  });

  it('keeps the old rows while the next page loads', async () => {
    const page1 = makeEventListPage({ page: 1 });
    const page2 = makeEventListPage({ page: 2, items: [makeEventListItem({ id: 99 })] });
    const second = deferred<FetchOutcome<EventListPage>>();
    const fetchEvents = vi
      .fn<FetchEventsFn>()
      .mockResolvedValueOnce(ok(page1))
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderUseEvents(fetchEvents);
    await waitFor(() => expect(result.current.status).toBe('ok'));

    rerender({ query: makeQuery({ page: 2 }) });

    expect(result.current).toMatchObject({ status: 'loading', data: page1 });
    await act(async () => {
      second.resolve(ok(page2));
    });
    expect(result.current).toMatchObject({ status: 'ok', data: page2 });
  });

  it('aborts the previous request and ignores its late response', async () => {
    const first = deferred<FetchOutcome<EventListPage>>();
    const second = deferred<FetchOutcome<EventListPage>>();
    const fetchEvents = vi
      .fn<FetchEventsFn>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderUseEvents(fetchEvents);

    rerender({ query: makeQuery({ page: 2 }) });

    expect(fetchEvents.mock.calls[0][1]?.aborted).toBe(true);
    expect(fetchEvents.mock.calls[1][1]?.aborted).toBe(false);

    const fresh = makeEventListPage({ page: 2 });
    await act(async () => {
      second.resolve(ok(fresh));
    });
    await act(async () => {
      first.resolve(ok(makeEventListPage({ page: 1 }))); // stale, arrives last
    });

    expect(result.current).toMatchObject({ status: 'ok', data: fresh });
  });

  it('stops fetching when the query becomes null', async () => {
    const fetchEvents = vi.fn<FetchEventsFn>().mockResolvedValue(ok(makeEventListPage()));
    const { result, rerender } = renderUseEvents(fetchEvents);
    await waitFor(() => expect(result.current.status).toBe('ok'));

    rerender({ query: null });

    expect(result.current.status).toBe('idle');
    expect(fetchEvents).toHaveBeenCalledTimes(1);
  });

  it('shows the error, then refetches on retry()', async () => {
    const data = makeEventListPage();
    const fetchEvents = vi
      .fn<FetchEventsFn>()
      .mockResolvedValueOnce({
        kind: 'http-error',
        httpStatus: 500,
        message: 'Server error: boom (ref: abcd1234)',
        refId: 'abcd1234',
      })
      .mockResolvedValueOnce(ok(data));
    const { result } = renderUseEvents(fetchEvents);

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      status: 'error',
      error: { message: 'Server error: boom (ref: abcd1234)', refId: 'abcd1234' },
    });

    act(() => {
      result.current.retry();
    });

    expect(result.current).toMatchObject({ status: 'loading', data: null });
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(fetchEvents).toHaveBeenCalledTimes(2);
  });

  it('shows an error instead of hanging if the fetch function rejects', async () => {
    const fetchEvents = vi.fn<FetchEventsFn>().mockRejectedValue(new Error('bug'));

    const { result } = renderUseEvents(fetchEvents);

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current).toMatchObject({
      error: { message: UNEXPECTED_EVENTS_ERROR_MESSAGE, refId: null },
    });
  });

  it('aborts the request on unmount', () => {
    const fetchEvents = vi
      .fn<FetchEventsFn>()
      .mockReturnValue(deferred<FetchOutcome<EventListPage>>().promise);
    const { unmount } = renderUseEvents(fetchEvents);

    unmount();

    expect(fetchEvents.mock.calls[0][1]?.aborted).toBe(true);
  });
});
