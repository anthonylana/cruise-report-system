import type { FoodReportRow } from '../../../types/events';
import { formatLabel, formatOptional } from '../../../utils/format';
import { DetailSection } from './DetailSection';
import { FieldList, type Field } from './FieldList';

type Props = { reports: FoodReportRow[] };

/** "Buffet — Elite", "Plated", or "Food report" when nothing is known. */
function reportTitle(report: FoodReportRow): string {
  const type = report.report_type === null ? null : formatLabel(report.report_type);
  const parts = [type, report.client_name].filter((p): p is string => p !== null && p !== '');
  return parts.length === 0 ? 'Food report' : parts.join(' — ');
}

export function FoodReportsList({ reports }: Props) {
  return (
    <DetailSection title="Food reports">
      {reports.length === 0 ? (
        <p className="text-sm text-slate-500">No food reports recorded.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((r, i) => {
            const fields: Field[] = [
              ['Quality', formatOptional(r.quality)],
              ['Presentation', formatOptional(r.presentation)],
              ['Substitutions', formatOptional(r.substitutions)],
              ['Quantity shortages', formatOptional(r.quantity_shortages)],
              ['Problems / praises', formatOptional(r.problems_praises)],
              ['Items required', formatOptional(r.items_required)],
              ['Other', formatOptional(r.other)],
              ['Completed by', formatOptional(r.completed_by)],
            ];
            return (
              // No id in the API row. Index keys are safe: never reordered or edited.
              <article key={i} className="flex flex-col gap-2 rounded border border-gray-200 p-3">
                <h3 className="font-medium">{reportTitle(r)}</h3>
                <FieldList fields={fields} />
              </article>
            );
          })}
        </div>
      )}
    </DetailSection>
  );
}
