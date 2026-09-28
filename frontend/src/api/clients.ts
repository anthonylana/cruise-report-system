import type { FetchOutcome } from '../types/api';
import type { Client } from '../types/clients';
import { getJson } from './client';
import { isNonNegativeInt, isRecord } from './validation';

// ---------- runtime type guards ----------

/** True only if `value` has exactly the shape of the backend's ClientOut. */
export function isClient(value: unknown): value is Client {
  return (
    isRecord(value) &&
    isNonNegativeInt(value.id) &&
    typeof value.name === 'string' &&
    isNonNegativeInt(value.event_count)
  );
}

export function isClientList(value: unknown): value is Client[] {
  return Array.isArray(value) && value.every(isClient);
}

// ---------- the API call ----------

/** Fetches every client (sorted by the backend). Never throws. */
export function getClients(signal?: AbortSignal): Promise<FetchOutcome<Client[]>> {
  return getJson('/api/clients', isClientList, { signal });
}
