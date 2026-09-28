// Shared HTTP helpers. Every API module builds URLs through here.

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
