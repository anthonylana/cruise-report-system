import type { SecurityIncidentRow } from '../../../types/events';
import { DetailSection } from './DetailSection';

type Props = { incidents: SecurityIncidentRow[] };

export function IncidentsList({ incidents }: Props) {
  return (
    <DetailSection title="Security incidents">
      {incidents.length === 0 ? (
        <p className="text-sm text-slate-500">No security incidents recorded.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {incidents.map((inc, i) => (
            <li key={i}>
              <span className="font-medium">{inc.guard_name}:</span>{' '}
              <span className="whitespace-pre-line">
                {inc.incident_description ?? 'No description.'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}
