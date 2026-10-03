// Pure display formatters for the events table. No React, so they live in utils/.

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'June',
  'July',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
];

/** Placeholder shown for null values (missing data, not zero). */
export const EMPTY_CELL = '—';

/**
 * "2026-09-06T19:00:00" (or "2026-09-06") -> "Sept 6, 2026".
 * Parsed from the string itself: no Date object, so no time-zone shift.
 * Returns the input unchanged if it doesn't look like a date.
 */
export function formatEventDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return iso;
  return `${monthName} ${Number(day)}, ${year}`;
}

/** "18:30:00" -> "18:30"; null -> "—". */
export function formatTime(hms: string | null): string {
  return hms === null ? EMPTY_CELL : hms.slice(0, 5);
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** 3450.5 -> "$3,450.50"; 0 -> "$0.00"; null (no bar data) -> "—". */
export function formatMoney(value: number | null): string {
  return value === null ? EMPTY_CELL : money.format(value);
}

/** null -> "—", anything else as text. */
export function formatOptional(value: string | number | null): string {
  return value === null ? EMPTY_CELL : String(value);
}
