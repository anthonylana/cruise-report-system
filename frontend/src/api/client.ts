// Shared HTTP helpers. Every API module builds URLs through here.

import type { FetchOutcome } from '../types/api';
import { extractRefId, formatValidationDetail, isRecord } from './validation';

const DEFAULT_API_BASE_URL = 'http://localhost:8000';

// `||` (not `??`) so an empty string also falls back to the default.
// Trailing slashes are stripped so apiUrl() never produces "//api".
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/+$/,
  '',
);

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

/** Shared wording for "no HTTP response at all". */
export function networkErrorMessage(): string {
  return `No response from the backend at ${API_BASE_URL}. Is it running? (docker compose ps)`;
}

/**
 * Reads a response body as JSON without ever throwing.
 * Returns `undefined` for empty or non-JSON bodies (e.g. an HTML error page).
 * The return type is `unknown`: callers MUST validate before using it.
 */
export async function readJsonBody(response: Response): Promise<unknown> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return undefined;
  }
  if (text.trim() === '') {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export interface GetJsonOptions {
  /** From an AbortController: lets the caller cancel the request. */
  signal?: AbortSignal;
}

/**
 * GETs `path` and validates the JSON body with `isValid`.
 * Never throws: every situation is returned as a FetchOutcome<T>.
 * T is inferred from the guard, e.g. getJson('/api/clients', isClientList) -> FetchOutcome<Client[]>.
 */
export async function getJson<T>(
  path: string,
  isValid: (value: unknown) => value is T,
  { signal }: GetJsonOptions = {},
): Promise<FetchOutcome<T>> {
  let response: Response;
  try {
    // Accept is a CORS-safelisted header, so this stays a "simple" request (no preflight).
    response = await fetch(apiUrl(path), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
  } catch {
    // An abort makes fetch reject too: tell the two apart.
    if (signal?.aborted) {
      return { kind: 'aborted' };
    }
    return { kind: 'network-error', message: networkErrorMessage() };
  }

  const body = await readJsonBody(response);
  if (signal?.aborted) {
    return { kind: 'aborted' }; // aborted while the body was streaming
  }

  if (response.ok) {
    if (isValid(body)) {
      return { kind: 'ok', data: body }; // body is narrowed to T here
    }
    return {
      kind: 'invalid-response',
      httpStatus: response.status,
      message: `The server's response did not have the expected format (HTTP ${response.status}).`,
    };
  }

  // Error codes: use {"detail": ...} when present (our JSON 500s, FastAPI 404/422).
  const detail = isRecord(body) ? formatValidationDetail(body.detail) : null;
  const prefix = response.status >= 500 ? 'Server error' : 'Request failed';
  return {
    kind: 'http-error',
    httpStatus: response.status,
    message: detail ? `${prefix}: ${detail}` : `${prefix} (HTTP ${response.status}).`,
    refId: extractRefId(detail),
  };
}
