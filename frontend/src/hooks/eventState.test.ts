import { describe, expect, it } from 'vitest';
import { makeEventDetail } from '../test/factories';
import {
  eventReducer,
  eventRequestKey,
  initialEventState,
  outcomeToAction,
  selectEventView,
  type EventState,
} from './eventState';

const ERROR = { message: 'Boom', refId: null };

describe('eventRequestKey', () => {
  it('is equal for the same id and reloadKey', () => {
    expect(eventRequestKey(42, 0)).toBe(eventRequestKey(42, 0));
  });

  it('changes when the id or the reloadKey changes', () => {
    const base = eventRequestKey(42, 0);
    expect(eventRequestKey(43, 0)).not.toBe(base);
    expect(eventRequestKey(42, 1)).not.toBe(base);
  });
});

describe('eventReducer', () => {
  it('stores data with its key on success', () => {
    const data = makeEventDetail();
    const state = eventReducer(initialEventState, { type: 'load-success', key: 'k1', data });
    expect(state).toEqual({ settled: { key: 'k1', result: { kind: 'ok', data } } });
  });

  it('stores not-found with its key', () => {
    const state = eventReducer(initialEventState, { type: 'load-not-found', key: 'k1' });
    expect(state).toEqual({ settled: { key: 'k1', result: { kind: 'not-found' } } });
  });

  it('replaces data with the error on failure', () => {
    const withData = eventReducer(initialEventState, {
      type: 'load-success',
      key: 'k1',
      data: makeEventDetail(),
    });
    const state = eventReducer(withData, { type: 'load-error', key: 'k2', error: ERROR });
    expect(state).toEqual({ settled: { key: 'k2', result: { kind: 'error', error: ERROR } } });
  });
});

describe('outcomeToAction', () => {
  it('maps ok to load-success', () => {
    const data = makeEventDetail();
    expect(outcomeToAction({ kind: 'ok', data }, 'k')).toEqual({
      type: 'load-success',
      key: 'k',
      data,
    });
  });

  it('maps a 404 to load-not-found', () => {
    expect(
      outcomeToAction(
        { kind: 'http-error', httpStatus: 404, message: 'Not found', refId: null },
        'k',
      ),
    ).toEqual({ type: 'load-not-found', key: 'k' });
  });

  it.each([422, 500])('maps HTTP %i to load-error and keeps the refId', (httpStatus) => {
    expect(
      outcomeToAction({ kind: 'http-error', httpStatus, message: 'Bad', refId: 'abcd1234' }, 'k'),
    ).toEqual({ type: 'load-error', key: 'k', error: { message: 'Bad', refId: 'abcd1234' } });
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

describe('selectEventView', () => {
  const data = makeEventDetail();
  const okState: EventState = { settled: { key: 'k1', result: { kind: 'ok', data } } };

  it('is idle without a request key', () => {
    expect(selectEventView(okState, null)).toEqual({ status: 'idle' });
  });

  it('is loading before the first response', () => {
    expect(selectEventView(initialEventState, 'k1')).toEqual({ status: 'loading' });
  });

  it('is ok when the settled key matches', () => {
    expect(selectEventView(okState, 'k1')).toEqual({ status: 'ok', data });
  });

  it('does not show the previous event while another one loads', () => {
    expect(selectEventView(okState, 'k2')).toEqual({ status: 'loading' });
  });

  it('is not-found when the settled key matches a 404', () => {
    const state: EventState = { settled: { key: 'k1', result: { kind: 'not-found' } } };
    expect(selectEventView(state, 'k1')).toEqual({ status: 'not-found' });
  });

  it('is error when the settled key matches a failure', () => {
    const state: EventState = { settled: { key: 'k1', result: { kind: 'error', error: ERROR } } };
    expect(selectEventView(state, 'k1')).toEqual({ status: 'error', error: ERROR });
    expect(selectEventView(state, 'k2')).toEqual({ status: 'loading' });
  });
});
