import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { deferred, makeFile, makeOutcome } from '../test/factories';
import type { UploadOutcome } from '../types/imports';
import { useUploadQueue, type UploadFn } from './useUploadQueue';

describe('useUploadQueue', () => {
  it('uploads files one at a time and tracks each status', async () => {
    const first = deferred<UploadOutcome>();
    const second = deferred<UploadOutcome>();
    const upload = vi
      .fn<UploadFn>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useUploadQueue(upload));
    const files = [makeFile('a.xls'), makeFile('b.xls')];

    let done!: Promise<void>;
    act(() => {
      done = result.current.start(files, 2026);
    });

    // Only the first file is in flight; the second waits its turn.
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledWith(files[0], 2026);
    expect(result.current.isRunning).toBe(true);
    expect(result.current.items.map((i) => i.status)).toEqual(['uploading', 'pending']);

    await act(async () => {
      first.resolve(makeOutcome({ filename: 'a.xls', status: 'imported' }));
    });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(2));
    expect(result.current.items.map((i) => i.status)).toEqual(['imported', 'uploading']);

    await act(async () => {
      second.resolve(makeOutcome({ filename: 'b.xls', status: 'skipped' }));
      await done;
    });

    expect(result.current.phase).toBe('done');
    expect(result.current.summary).toMatchObject({
      total: 2,
      imported: 1,
      skipped: 1,
      error: 0,
    });
  });

  it('shows a network error as an error row and continues with the next file', async () => {
    const upload = vi
      .fn<UploadFn>()
      .mockResolvedValueOnce({ kind: 'network-error', message: 'No response from the backend' })
      .mockResolvedValueOnce(makeOutcome({ filename: 'b.xls' }));
    const { result } = renderHook(() => useUploadQueue(upload));

    await act(async () => {
      await result.current.start([makeFile('a.xls'), makeFile('b.xls')], 2026);
    });

    expect(result.current.items[0].status).toBe('error');
    expect(result.current.items[0].result?.message).toMatch(/no response/i);
    expect(result.current.items[1].status).toBe('imported');
  });

  it('turns an unexpected throw into an error result instead of getting stuck', async () => {
    const upload = vi.fn<UploadFn>().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useUploadQueue(upload));

    await act(async () => {
      await result.current.start([makeFile('a.xls')], 2026);
    });

    expect(result.current.items[0].status).toBe('error');
    expect(result.current.items[0].result?.message).toMatch(/unexpected/i);
    expect(result.current.phase).toBe('done');
  });

  it('ignores a second start while a batch is running', async () => {
    const pending = deferred<UploadOutcome>();
    const upload = vi.fn<UploadFn>().mockReturnValue(pending.promise);
    const { result } = renderHook(() => useUploadQueue(upload));

    let done!: Promise<void>;
    act(() => {
      done = result.current.start([makeFile('a.xls')], 2026);
    });
    await act(async () => {
      await result.current.start([makeFile('b.xls')], 2026);
    });

    expect(upload).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve(makeOutcome());
      await done;
    });
  });

  it('does nothing when started with no files', async () => {
    const upload = vi.fn<UploadFn>();
    const { result } = renderHook(() => useUploadQueue(upload));

    await act(async () => {
      await result.current.start([], 2026);
    });

    expect(upload).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });

  it('reset clears the results after a batch', async () => {
    const upload = vi.fn<UploadFn>().mockResolvedValue(makeOutcome());
    const { result } = renderHook(() => useUploadQueue(upload));

    await act(async () => {
      await result.current.start([makeFile('a.xls')], 2026);
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.phase).toBe('idle');
  });
});
