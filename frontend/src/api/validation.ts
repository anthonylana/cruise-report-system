// Neutral runtime-validation helpers shared by every API module.
// Kept separate from client.ts and imports.ts to avoid circular imports.

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** A whole number >= 0 (rejects 1.5, -1, NaN, "3"). */
export function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Turns FastAPI's default validation body ({"detail": [{loc, msg, ...}]})
 * into a readable line, e.g. "year: Input should be a valid integer".
 * Returns null if `detail` is not in a shape we recognize.
 */
export function formatValidationDetail(detail: unknown): string | null {
  if (typeof detail === 'string' && detail.trim() !== '') {
    return detail; // e.g. HTTPException(detail="...") or our JSON 500
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
