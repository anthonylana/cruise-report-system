import { MAX_UPLOAD_BYTES, MIN_YEAR } from '../api/imports';

export type RejectedFile = { name: string; reason: string };
export type FileSelection = { accepted: File[]; rejected: RejectedFile[] };

const MB = 1024 * 1024;

/** Returns why a file can't be uploaded, or null if it's fine. Mirrors the backend checks. */
export function rejectionReason(file: File): string | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    return 'Only Excel 97-2003 (.xls) is supported. Save the file as .xls first.';
  }
  if (!name.endsWith('.xls')) return 'Not an .xls file.';
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_UPLOAD_BYTES) return `Larger than ${MAX_UPLOAD_BYTES / MB} MB.`;
  return null;
}

export function validateFiles(files: File[]): FileSelection {
  const accepted: File[] = [];
  const rejected: RejectedFile[] = [];
  for (const file of files) {
    const reason = rejectionReason(file);
    if (reason) rejected.push({ name: file.name, reason });
    else accepted.push(file);
  }
  return { accepted, rejected };
}

/** Newest first: next year (for early bookings) down to MIN_YEAR. */
export function yearOptions(currentYear: number): number[] {
  const years: number[] = [];
  for (let y = currentYear + 1; y >= MIN_YEAR; y--) years.push(y);
  return years;
}
