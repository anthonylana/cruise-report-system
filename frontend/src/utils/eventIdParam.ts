/** Name of the dynamic segment in the route path "events/:id". */
export const EVENT_ID_PARAM = 'id';

// Canonical positive integer: no sign, no leading zeros, no decimals, no spaces.
const POSITIVE_INT = /^[1-9]\d*$/;

/**
 * Raw `:id` from useParams -> event id, or null if it isn't a valid id.
 * null means "don't fetch": the page shows "Event not found".
 */
export function parseEventIdParam(raw: string | undefined): number | null {
  if (raw === undefined || !POSITIVE_INT.test(raw)) return null;
  const id = Number(raw);
  // Huge numbers lose precision as JS numbers ("9007199254740993" -> ...992).
  return Number.isSafeInteger(id) ? id : null;
}
