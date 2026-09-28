import { IMPORT_STATUSES } from '../types/imports';
import type { ImportResult, ImportStatus, UploadOutcome } from '../types/imports';
import { apiUrl, networkErrorMessage, readJsonBody } from './client';
import { formatValidationDetail, isRecord, isStringOrNull } from './validation';

// Re-exported so existing imports (and imports.test.ts) keep working.
export { extractRefId, formatValidationDetail } from './validation';

/** Mirrors MAX_UPLOAD_BYTES in backend/app/api/routes/imports.py. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/** Mirrors MIN_YEAR in the backend. The max is current year + 1. */
export const MIN_YEAR = 2000;

// ---------- runtime type guards ----------

export function isImportStatus(value: unknown): value is ImportStatus {
  // Widen the readonly literal tuple to readonly string[] so .includes accepts any string.
  return typeof value === 'string' && (IMPORT_STATUSES as readonly string[]).includes(value);
}

/** True only if `value` has exactly the shape of the backend's ImportResponse. */
export function isImportResult(value: unknown): value is ImportResult {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.filename === 'string' &&
    isImportStatus(value.status) &&
    (value.event_id === null || typeof value.event_id === 'number') &&
    isStringOrNull(value.event_date) &&
    isStringOrNull(value.client_name) &&
    isStringOrNull(value.message) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((w) => typeof w === 'string')
  );
}

// ---------- the API call ----------

/**
 * Uploads ONE .xls file for the given year.
 * Never throws: every possible situation is returned as an UploadOutcome.
 */
export async function uploadImport(file: File, year: number): Promise<UploadOutcome> {
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('year', String(year)); // FormData values are strings (or Blobs)

  let response: Response;
  try {
    // No Content-Type header: the browser sets multipart/form-data + boundary.
    response = await fetch(apiUrl('/api/imports'), {
      method: 'POST',
      body: form,
    });
  } catch {
    // fetch rejects only when no readable HTTP response arrived (backend down, DNS, CORS).
    // Unhandled server crashes now return a CORS-safe JSON 500 (UnhandledErrorMiddleware).
    return { kind: 'network-error', message: networkErrorMessage() };
  }

  const body = await readJsonBody(response);

  // Contract body: trust the body's status, whatever the HTTP code was.
  if (isImportResult(body)) {
    return { kind: 'result', httpStatus: response.status, body };
  }

  // {"detail": ...}: FastAPI validation errors (4xx) or our JSON 500 with a ref ID.
  if (isRecord(body)) {
    const detail = formatValidationDetail(body.detail);
    if (detail) {
      const prefix = response.status >= 500 ? 'Server error' : 'Server rejected the request';
      return {
        kind: 'unexpected-response',
        httpStatus: response.status,
        message: `${prefix}: ${detail}`,
      };
    }
  }

  // Anything else: HTML error page, empty body, unknown JSON...
  return {
    kind: 'unexpected-response',
    httpStatus: response.status,
    message: `Unexpected response from server (HTTP ${response.status}).`,
  };
}
