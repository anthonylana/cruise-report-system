import type { ImportResult, UploadOutcome } from '../types/imports';

export function makeFile(name: string, content = 'x'): File {
  return new File([content], name, { type: 'application/vnd.ms-excel' });
}

export function makeResult(overrides: Partial<ImportResult> = {}): ImportResult {
  return {
    filename: 'a.xls',
    status: 'imported',
    event_id: 1,
    event_date: '2026-09-06',
    client_name: 'elite',
    message: null,
    warnings: [],
    ...overrides,
  };
}

const HTTP_BY_STATUS = { imported: 201, skipped: 409, error: 422 } as const;

/** A "result" outcome, as uploadImport returns for a contract body. */
export function makeOutcome(overrides: Partial<ImportResult> = {}): UploadOutcome {
  const body = makeResult(overrides);
  return { kind: 'result', httpStatus: HTTP_BY_STATUS[body.status], body };
}

// A promise we resolve manually, to freeze an upload "in flight" during a test.
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
