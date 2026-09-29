/** Query-string key for the selected client, e.g. /events?client=3 */
export const CLIENT_PARAM = 'client';

/**
 * Turns the raw ?client= value into a client id.
 * Anything that isn't a positive whole number (missing, "abc", "-1", "1.5", "01") means "All clients".
 */
export function parseClientParam(raw: string | null): number | null {
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}
