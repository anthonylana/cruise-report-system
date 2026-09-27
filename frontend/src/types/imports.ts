// Mirrors backend/app/schemas/imports.py (ImportResponse).

// `as const` makes this a readonly tuple of literal types, not string[].
// We use the array at runtime (type guard) AND derive the type from it,
// so the list of statuses is written exactly once.
export const IMPORT_STATUSES = ['imported', 'skipped', 'error'] as const;

// (typeof IMPORT_STATUSES)[number] -> "imported" | "skipped" | "error"
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export interface ImportResult {
  filename: string;
  status: ImportStatus;
  event_id: number | null;
  /** ISO date "YYYY-MM-DD". Kept as a string to avoid Date timezone shifts. */
  event_date: string | null;
  client_name: string | null;
  message: string | null;
  warnings: string[];
}

/**
 * Everything that can happen when uploading one file.
 * A discriminated union on `kind`: check `kind` and TypeScript narrows the type.
 * uploadImport() never throws; it always resolves to one of these.
 */
export type UploadOutcome =
  // Body matched the contract (201 imported, 409 skipped, 413/422/500 error)
  | { kind: 'result'; httpStatus: number; body: ImportResult }
  // Server answered, but not with the contract (FastAPI {"detail": [...]}, HTML, bad JSON)
  | { kind: 'unexpected-response'; httpStatus: number; message: string }
  // No answer at all (backend down, CORS blocked, DNS...)
  | { kind: 'network-error'; message: string };
