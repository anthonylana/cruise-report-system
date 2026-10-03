/** Query-string keys for the date range, e.g. /events?from=2026-06-01&to=2026-06-30 */
export const FROM_PARAM = 'from';
export const TO_PARAM = 'to';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/**
 * Turns a raw ?from= / ?to= value into a "YYYY-MM-DD" string.
 * Anything that isn't a real calendar date in that exact format
 * (missing, "abc", "2026-9-6", "2026-02-30", "0000-01-01") means "no filter".
 */
export function parseDateParam(raw: string | null): string | null {
  if (raw === null) return null;
  const match = DATE_RE.exec(raw);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return raw;
}

/**
 * True when both dates are set and "from" is after "to".
 * Plain string comparison is safe: parseDateParam guarantees the fixed-width ISO format.
 */
export function isDateRangeInverted(from: string | null, to: string | null): boolean {
  return from !== null && to !== null && from > to;
}
