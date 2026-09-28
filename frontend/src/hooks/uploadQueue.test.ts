import { describe, expect, it } from 'vitest';
import { makeFile, makeResult } from '../test/factories';
import {
  createQueueItems,
  initialQueueState,
  outcomeToResult,
  queueReducer,
  summarize,
  type QueueState,
} from './uploadQueue';

function startedState(): QueueState {
  const items = createQueueItems([makeFile('a.xls'), makeFile('b.xls')]);
  return queueReducer(initialQueueState, { type: 'start', items, year: 2026 });
}

describe('createQueueItems', () => {
  it('creates pending items with unique ids, even for duplicate names', () => {
    const items = createQueueItems([makeFile('a.xls'), makeFile('a.xls')]);

    expect(items.map((i) => i.status)).toEqual(['pending', 'pending']);
    expect(new Set(items.map((i) => i.id)).size).toBe(2);
  });
});

describe('queueReducer', () => {
  it('start sets phase, year and items', () => {
    const state = startedState();

    expect(state.phase).toBe('running');
    expect(state.year).toBe(2026);
    expect(state.items).toHaveLength(2);
  });

  it('uploading changes only the matching item', () => {
    const state = startedState();
    const next = queueReducer(state, {
      type: 'uploading',
      id: state.items[0].id,
    });

    expect(next.items.map((i) => i.status)).toEqual(['uploading', 'pending']);
    expect(state.items[0].status).toBe('pending'); // original not mutated
  });

  it('finished stores the result and uses its status', () => {
    const state = startedState();
    const result = makeResult({ status: 'skipped', message: 'Duplicate' });
    const next = queueReducer(state, {
      type: 'finished',
      id: state.items[1].id,
      result,
    });

    expect(next.items[1].status).toBe('skipped');
    expect(next.items[1].result).toEqual(result);
  });

  it('complete marks the batch as done', () => {
    expect(queueReducer(startedState(), { type: 'complete' }).phase).toBe('done');
  });

  it('reset returns to the initial state', () => {
    expect(queueReducer(startedState(), { type: 'reset' })).toEqual(initialQueueState);
  });
});

describe('summarize', () => {
  it('counts items per status', () => {
    let state = startedState();
    state = queueReducer(state, {
      type: 'finished',
      id: state.items[0].id,
      result: makeResult({ status: 'imported' }),
    });

    expect(summarize(state.items)).toEqual({
      total: 2,
      pending: 1,
      uploading: 0,
      imported: 1,
      skipped: 0,
      error: 0,
    });
  });
});

describe('outcomeToResult', () => {
  it('passes a contract body through unchanged', () => {
    const body = makeResult({ status: 'skipped', message: 'Duplicate' });

    expect(outcomeToResult('a.xls', { kind: 'result', httpStatus: 409, body })).toBe(body);
  });

  it('turns a network error into an error row for that file', () => {
    const result = outcomeToResult('a.xls', { kind: 'network-error', message: 'No response' });

    expect(result).toMatchObject({ filename: 'a.xls', status: 'error', message: 'No response' });
  });

  it('turns an unexpected response into an error row for that file', () => {
    const result = outcomeToResult('b.xls', {
      kind: 'unexpected-response',
      httpStatus: 500,
      message: 'Unexpected response from server (HTTP 500).',
    });

    expect(result).toMatchObject({ filename: 'b.xls', status: 'error', event_id: null });
    expect(result.message).toContain('HTTP 500');
  });
});
