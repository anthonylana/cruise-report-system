import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getClients, isClient, isClientList } from './clients';
import { makeClient } from '../test/factories';

// ---------- helpers ----------

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
});

// ---------- getClients (exercises every branch of getJson) ----------

describe('getClients', () => {
  it('GETs /api/clients and passes the abort signal through', async () => {
    fetchMock.mockResolvedValue(jsonResponse([], 200));
    const controller = new AbortController();

    await getClients(controller.signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/clients');
    expect(init?.method).toBe('GET');
    expect(init?.signal).toBe(controller.signal);
  });

  it('returns ok with the validated list', async () => {
    const clients = [makeClient(), makeClient({ id: 2, name: 'elite/christian', event_count: 0 })];
    fetchMock.mockResolvedValue(jsonResponse(clients, 200));

    const outcome = await getClients();

    expect(outcome).toEqual({ kind: 'ok', data: clients });
  });

  it('returns ok with an empty list', async () => {
    fetchMock.mockResolvedValue(jsonResponse([], 200));

    expect(await getClients()).toEqual({ kind: 'ok', data: [] });
  });

  it('returns invalid-response when a 200 body breaks the contract', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ id: 1, name: 'x' }], 200)); // no event_count

    const outcome = await getClients();

    expect(outcome.kind).toBe('invalid-response');
  });

  it('returns invalid-response for a non-JSON 200 body', async () => {
    fetchMock.mockResolvedValue(new Response('<html></html>', { status: 200 }));

    expect((await getClients()).kind).toBe('invalid-response');
  });

  it('returns http-error with the ref id for our JSON 500', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: 'Internal server error (ref: a1b2c3d4)' }, 500),
    );

    const outcome = await getClients();

    expect(outcome).toEqual({
      kind: 'http-error',
      httpStatus: 500,
      message: 'Server error: Internal server error (ref: a1b2c3d4)',
      refId: 'a1b2c3d4',
    });
  });

  it('returns http-error with a generic message when there is no detail', async () => {
    fetchMock.mockResolvedValue(new Response('Bad Gateway', { status: 502 }));

    expect(await getClients()).toEqual({
      kind: 'http-error',
      httpStatus: 502,
      message: 'Server error (HTTP 502).',
      refId: null,
    });
  });

  it('returns http-error for a 4xx with detail', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: 'Not Found' }, 404));

    const outcome = await getClients();

    expect(outcome).toMatchObject({ kind: 'http-error', message: 'Request failed: Not Found' });
  });

  it('returns network-error when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const outcome = await getClients();

    expect(outcome.kind).toBe('network-error');
    if (outcome.kind === 'network-error') {
      expect(outcome.message).toContain('http://localhost:8000');
    }
  });

  it('returns aborted (not network-error) when the request was cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));

    expect(await getClients(controller.signal)).toEqual({ kind: 'aborted' });
  });

  it('returns aborted when the abort lands while the body is being read', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(async () => {
      controller.abort(); // response arrived, then we stopped caring
      return jsonResponse([makeClient()], 200);
    });

    expect(await getClients(controller.signal)).toEqual({ kind: 'aborted' });
  });
});

// ---------- guards ----------

describe('isClient / isClientList', () => {
  it('accepts a valid client', () => {
    expect(isClient(makeClient())).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string id', { ...makeClient(), id: '1' }],
    ['a fractional event_count', { ...makeClient(), event_count: 1.5 }],
    ['a negative event_count', { ...makeClient(), event_count: -1 }],
    ['a null name', { ...makeClient(), name: null }],
  ])('rejects %s', (_label, value) => {
    expect(isClient(value)).toBe(false);
  });

  it('rejects a list if any item is invalid, and a non-array', () => {
    expect(isClientList([makeClient(), { id: 2 }])).toBe(false);
    expect(isClientList({ items: [] })).toBe(false);
  });
});
