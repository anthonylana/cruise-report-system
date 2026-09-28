import type { ItemStatus } from '../../hooks/uploadQueue';

// Record<ItemStatus, ...> forces an entry for every status: add a status, TS makes you style it.
const STYLES: Record<ItemStatus, { label: string; className: string }> = {
  pending: { label: 'Waiting', className: 'bg-gray-100 text-gray-700' },
  uploading: { label: 'Uploading…', className: 'bg-blue-100 text-blue-800' },
  imported: { label: 'Imported', className: 'bg-green-100 text-green-800' },
  skipped: { label: 'Skipped', className: 'bg-amber-100 text-amber-800' },
  error: { label: 'Error', className: 'bg-red-100 text-red-800' },
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  const { label, className } = STYLES[status];
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}
