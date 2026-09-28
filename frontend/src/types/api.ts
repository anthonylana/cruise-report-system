// Generic outcome of a GET request. Used by every read endpoint (clients, events, ...).

/**
 * Everything that can happen when fetching data of type T.
 * A discriminated union on `kind`: getJson() never throws; it always resolves to one of these.
 */
export type FetchOutcome<T> =
  // 2xx and the body passed runtime validation
  | { kind: 'ok'; data: T }
  // Server answered with an error code (404, 422, 500...). refId is set for our JSON 500s.
  | { kind: 'http-error'; httpStatus: number; message: string; refId: string | null }
  // 2xx but the body did not match the contract (backend/frontend types drifted apart)
  | { kind: 'invalid-response'; httpStatus: number; message: string }
  // No answer at all (backend down, DNS, CORS blocked)
  | { kind: 'network-error'; message: string }
  // We cancelled it ourselves (AbortController). Not an error: the UI ignores it.
  | { kind: 'aborted' };
