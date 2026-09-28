import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractRefId, formatValidationDetail, isImportResult, uploadImport } from './imports';
import type { ImportResult } from '../types/imports';

// ---------- helpers ----------

const validResult: ImportResult = {
  filename: 'Sept 6 Elite.xls',
  status: 'imported',
  event_id: 1,
  event_date: '2025-09-06',
  client_name: 'elite/christian',
  message: null,
  warnings: [],
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeFile(name = 'Sept 6 Elite.xls'): File {
  return new File(['fake xls bytes'], name, {
    type: 'application/vnd.ms-excel',
  });
}

// `typeof fetch` gives the mock the exact signature of the real fetch.
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
});

// ---------- uploadImport ----------

describe('uploadImport', () => {
  it('POSTs multipart FormData with file and year, without a Content-Type header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(validResult, 201));
    const file = makeFile();

    await uploadImport(file, 2025);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/imports');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toBeUndefined(); // browser must set the boundary itself
    expect(init?.body).toBeInstanceOf(FormData);

    const form = init?.body as FormData;
    expect(form.get('year')).toBe('2025');
    const sentFile = form.get('file');
    expect(sentFile).toBeInstanceOf(File);
    expect((sentFile as File).name).toBe('Sept 6 Elite.xls');
  });

  it('returns a result for 201 imported', async () => {
    fetchMock.mockResolvedValue(jsonResponse(validResult, 201));

    const outcome = await uploadImport(makeFile(), 2025);

    expect(outcome).toEqual({
      kind: 'result',
      httpStatus: 201,
      body: validResult,
    });
  });

  it('returns a result for 409 skipped (trusts the body, not the HTTP code)', async () => {
    const skipped = { ...validResult, status: 'skipped', event_id: null };
    fetchMock.mockResolvedValue(jsonResponse(skipped, 409));

    const outcome = await uploadImport(makeFile(), 2025);

    expect(outcome).toEqual({ kind: 'result', httpStatus: 409, body: skipped });
  });

  it('returns a result for 413 too large (contract error body)', async () => {
    const tooLarge = {
      ...validResult,
      status: 'error',
      event_id: null,
      event_date: null,
      client_name: null,
      message: 'File exceeds 10 MB limit',
    };
    fetchMock.mockResolvedValue(jsonResponse(tooLarge, 413));

    const outcome = await uploadImport(makeFile(), 2025);

    expect(outcome.kind).toBe('result');
  });

  it("formats FastAPI's default validation body", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          detail: [
            {
              type: 'int_parsing',
              loc: ['body', 'year'],
              msg: 'Input should be a valid integer',
            },
          ],
        },
        422,
      ),
    );

    const outcome = await uploadImport(makeFile(), 2025);

    expect(outcome).toEqual({
      kind: 'unexpected-response',
      httpStatus: 422,
      message: 'Server rejected the request: year: Input should be a valid integer',
    });
  });

  it('handles an HTML error page', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html><body>Bad Gateway</body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    const outcome = await uploadImport(makeFile(), 2025);

    expect(outcome).toEqual({
      kind: 'unexpected-response',
      httpStatus: 502,
      message: 'Unexpected response from server (HTTP 502).',
    });
  });

  it('handles an empty body', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));

    const outcome = await uploadImport(makeFile(), 2025);

    expect(outcome.kind).toBe('unexpected-response');
  });

  it('returns network-error when fetch rejects (backend down)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const outcome = await uploadImport(makeFile(), 2025);

    expect(outcome.kind).toBe('network-error');
    if (outcome.kind === 'network-error') {
      // Narrowing: TS only allows .message access inside this branch.
      expect(outcome.message).toContain('http://localhost:8000');
    }
  });
});

// ---------- isImportResult ----------

describe('isImportResult', () => {
  it('accepts a valid body', () => {
    expect(isImportResult(validResult)).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['an unknown status', { ...validResult, status: 'done' }],
    ['missing warnings', { ...validResult, warnings: undefined }],
    ['non-string warnings', { ...validResult, warnings: [1] }],
    ['a string event_id', { ...validResult, event_id: '1' }],
  ])('rejects %s', (_label, value) => {
    expect(isImportResult(value)).toBe(false);
  });
});

// ---------- helpers ----------

describe('extractRefId', () => {
  it('extracts the ref id', () => {
    expect(extractRefId('Import failed (ref: a1b2c3d4)')).toBe('a1b2c3d4');
  });

  it('returns null when there is no ref', () => {
    expect(extractRefId('Import failed. See server logs.')).toBeNull();
    expect(extractRefId(null)).toBeNull();
  });
});

describe('formatValidationDetail', () => {
  it('passes a plain string through', () => {
    expect(formatValidationDetail('Not allowed')).toBe('Not allowed');
  });

  it("joins multiple errors and drops the 'body' prefix", () => {
    expect(
      formatValidationDetail([
        { loc: ['body', 'file'], msg: 'Field required' },
        { loc: ['body', 'year'], msg: 'Field required' },
      ]),
    ).toBe('file: Field required; year: Field required');
  });

  it('returns null for unknown shapes', () => {
    expect(formatValidationDetail(undefined)).toBeNull();
    expect(formatValidationDetail([])).toBeNull();
    expect(formatValidationDetail({ foo: 1 })).toBeNull();
  });
});
