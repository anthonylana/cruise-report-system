/** Query-string key for the current page, e.g. /events?page=2 */
export const PAGE_PARAM = 'page';

/**
 * Turns the raw ?page= value into a page number.
 * Anything that isn't a positive whole number (missing, "abc", "0", "-1", "1.5", "02") means page 1.
 */
export function parsePageParam(raw: string | null): number {
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) ? page : 1;
}
