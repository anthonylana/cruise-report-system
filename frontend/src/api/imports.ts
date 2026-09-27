import { IMPORT_STATUSES } from '../types/imports';
import type { ImportResult, ImportStatus, UploadOutcome } from '../types/imports';
import { API_BASE_URL, apiUrl, readJsonBody } from './client';

/** Mirrors MAX_UPLOAD_BYTES in backend/app/api/routes/imports.py. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/** Mirrors MIN_YEAR in the backend. The max is current year + 1. */
export const MIN_YEAR = 2000;

// ---------- runtime type guards ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

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

// ---------- helpers ----------

/**
 * Turns FastAPI's default validation body ({"detail": [{loc, msg, ...}]})
 * into a readable line, e.g. "year: Input should be a valid integer".
 * Returns null if `detail` is not in a shape we recognize.
 */
export function formatValidationDetail(detail: unknown): string | null {
  if (typeof detail === 'string' && detail.trim() !== '') {
    return detail; // e.g. HTTPException(detail="...")
  }
  if (!Array.isArray(detail)) {
    return null;
  }
  const parts = detail.filter(isRecord).map((item) => {
    const msg = typeof item.msg === 'string' ? item.msg : 'Invalid value';
    const loc = Array.isArray(item.loc) ? item.loc.filter((part) => part !== 'body').join('.') : '';
    return loc ? `${loc}: ${msg}` : msg;
  });
  return parts.length > 0 ? parts.join('; ') : null;
}

/** Extracts "abcd1234" from a message like "... (ref: abcd1234)". */
export function extractRefId(message: string | null): string | null {
  if (!message) {
    return null;
  }
  const match = /\(ref:\s*([0-9a-f]{8})\)/i.exec(message);
  return match ? match[1] : null;
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
    // fetch rejects when no readable HTTP response arrived: backend down,
    // OR an unhandled server crash (those 500s carry no CORS headers).
    return {
      kind: 'network-error',
      message: `No response from the backend at ${API_BASE_URL}. It may be down, or it failed unexpectedly (check the backend logs).`,
    };
  }

  const body = await readJsonBody(response);

  // Contract body: trust the body's status, whatever the HTTP code was.
  if (isImportResult(body)) {
    return { kind: 'result', httpStatus: response.status, body };
  }

  // FastAPI's own validation error shape.
  if (isRecord(body)) {
    const detail = formatValidationDetail(body.detail);
    if (detail) {
      return {
        kind: 'unexpected-response',
        httpStatus: response.status,
        message: `Server rejected the request: ${detail}`,
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
