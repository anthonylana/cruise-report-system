import { describe, expect, it } from 'vitest';
import { makeClient } from '../test/factories';
import {
  clientsReducer,
  initialClientsState,
  outcomeToAction,
  type ClientsState,
} from './clientsState';

function loadedState(): ClientsState {
  return clientsReducer(initialClientsState, {
    type: 'load-success',
    clients: [makeClient()],
  });
}

describe('clientsReducer', () => {
  it('starts in loading with no clients', () => {
    expect(initialClientsState).toEqual({ status: 'loading', clients: [], error: null });
  });

  it('load-success stores the clients', () => {
    const state = loadedState();

    expect(state.status).toBe('ok');
    expect(state.clients).toEqual([makeClient()]);
  });

  it('load-error stores the error and drops the list', () => {
    const state = clientsReducer(loadedState(), {
      type: 'load-error',
      error: { message: 'Boom', refId: 'abcd1234' },
    });

    expect(state).toEqual({
      status: 'error',
      clients: [],
      error: { message: 'Boom', refId: 'abcd1234' },
    });
  });

  it('load-start keeps the current list and clears the error', () => {
    const state = loadedState();
    const next = clientsReducer(state, { type: 'load-start' });

    expect(next.status).toBe('loading');
    expect(next.clients).toBe(state.clients);
    expect(next.error).toBeNull();
  });
});

describe('outcomeToAction', () => {
  it('maps ok to load-success', () => {
    const clients = [makeClient()];

    expect(outcomeToAction({ kind: 'ok', data: clients })).toEqual({
      type: 'load-success',
      clients,
    });
  });

  it('keeps the ref ID of an http-error', () => {
    const action = outcomeToAction({
      kind: 'http-error',
      httpStatus: 500,
      message: 'Server error',
      refId: 'abcd1234',
    });

    expect(action).toEqual({
      type: 'load-error',
      error: { message: 'Server error', refId: 'abcd1234' },
    });
  });

  it('maps invalid-response and network-error to errors without a ref ID', () => {
    expect(
      outcomeToAction({ kind: 'invalid-response', httpStatus: 200, message: 'Bad shape' }),
    ).toEqual({ type: 'load-error', error: { message: 'Bad shape', refId: null } });
    expect(outcomeToAction({ kind: 'network-error', message: 'No response' })).toEqual({
      type: 'load-error',
      error: { message: 'No response', refId: null },
    });
  });

  it('ignores aborted', () => {
    expect(outcomeToAction({ kind: 'aborted' })).toBeNull();
  });
});
