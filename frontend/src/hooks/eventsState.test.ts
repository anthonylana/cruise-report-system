import { describe, expect, it } from 'vitest';
import { makeEventListPage } from '../test/factories';
import type { EventQuery } from '../types/events';
import {
  eventsReducer,
  eventsRequestKey,
  initialEventsState,
  outcomeToAction,
  selectEventsView,
  type EventsState,
} from './eventsState';

const QUERY: EventQuery = {
  page: 1,
  pageSize: 25,
  clientId: null,
  dateFrom: null,
  dateTo: null,
  sort: null,
};
const ERROR = { message: 'Boom', refId: null };

describe('eventsRequestKey', () => {
  it('is equal for equal queries, even as different objects', () => {
    expect(eventsRequestKey({ ...QUERY }, 0)).toBe(eventsRequestKey({ ...QUERY }, 0));
  });

  it('changes when any field or the reloadKey changes', () => {
    const base = eventsRequestKey(QUERY, 0);
    expect(eventsRequestKey({ ...QUERY, page: 2 }, 0)).not.toBe(base);
    expect(eventsRequestKey({ ...QUERY, clientId: 3 }, 0)).not.toBe(base);
    expect(eventsRequestKey({ ...QUERY, dateFrom: '2026-01-01' }, 0)).not.toBe(base);
    expect(eventsRequestKey({ ...QUERY, dateTo: '2026-01-01' }, 0)).not.toBe(base);
    expect(eventsRequestKey(QUERY, 1)).not.toBe(base);
  });
});

describe('eventsReducer', () => {
  it('stores data with its key on success', () => {
    const data = makeEventListPage();
    const state = eventsReducer(initialEventsState, { type: 'load-success', key: 'k1', data });
    expect(state).toEqual({ settled: { key: 'k1', result: { kind: 'ok', data } } });
  });

  it('replaces data with the error on failure', () => {
    const withData = eventsReducer(initialEventsState, {
      type: 'load-success',
      key: 'k1',
      data: makeEventListPage(),
    });
    const state = eventsReducer(withData, { type: 'load-error', key: 'k2', error: ERROR });
    expect(state).toEqual({ settled: { key: 'k2', result: { kind: 'error', error: ERROR } } });
  });
});

describe('outcomeToAction', () => {
  it('maps ok to load-success', () => {
    const data = makeEventListPage();
    expect(outcomeToAction({ kind: 'ok', data }, 'k')).toEqual({
      type: 'load-success',
      key: 'k',
      data,
    });
  });

  it('keeps the refId of an http-error', () => {
    const action = outcomeToAction(
      { kind: 'http-error', httpStatus: 500, message: 'Server error', refId: 'abcd1234' },
      'k',
    );
    expect(action).toEqual({
      type: 'load-error',
      key: 'k',
      error: { message: 'Server error', refId: 'abcd1234' },
    });
  });

  it('maps invalid-response and network-error to load-error without refId', () => {
    expect(
      outcomeToAction({ kind: 'invalid-response', httpStatus: 200, message: 'Bad shape' }, 'k'),
    ).toEqual({ type: 'load-error', key: 'k', error: { message: 'Bad shape', refId: null } });
    expect(outcomeToAction({ kind: 'network-error', message: 'Down' }, 'k')).toEqual({
      type: 'load-error',
      key: 'k',
      error: { message: 'Down', refId: null },
    });
  });

  it('returns null for aborted', () => {
    expect(outcomeToAction({ kind: 'aborted' }, 'k')).toBeNull();
  });
});

describe('selectEventsView', () => {
  const data = makeEventListPage();
  const okState: EventsState = { settled: { key: 'k1', result: { kind: 'ok', data } } };
  const errorState: EventsState = {
    settled: { key: 'k1', result: { kind: 'error', error: ERROR } },
  };

  it('is idle without a request key', () => {
    expect(selectEventsView(okState, null)).toEqual({ status: 'idle' });
  });

  it('is loading with no data before the first response', () => {
    expect(selectEventsView(initialEventsState, 'k1')).toEqual({ status: 'loading', data: null });
  });

  it('is ok when the settled key matches', () => {
    expect(selectEventsView(okState, 'k1')).toEqual({ status: 'ok', data });
  });

  it('keeps the previous data while a new key loads', () => {
    expect(selectEventsView(okState, 'k2')).toEqual({ status: 'loading', data });
  });

  it('is error when the settled key matches a failure', () => {
    expect(selectEventsView(errorState, 'k1')).toEqual({ status: 'error', error: ERROR });
  });

  it('does not carry an error into the next load', () => {
    expect(selectEventsView(errorState, 'k2')).toEqual({ status: 'loading', data: null });
  });
});
