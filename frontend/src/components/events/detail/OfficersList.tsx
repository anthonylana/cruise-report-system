import type { EventOfficer } from '../../../types/events';
import { formatLabel } from '../../../utils/format';
import { DetailSection } from './DetailSection';

type Props = { officers: EventOfficer[] };

export function OfficersList({ officers }: Props) {
  return (
    <DetailSection title="Officers">
      {officers.length === 0 ? (
        <p className="text-sm text-slate-500">No officers recorded.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {officers.map((o, i) => (
            <li key={i}>
              <span className="font-medium">{formatLabel(o.position)}:</span> {o.officer_name}
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}
