import type { EventDetail } from '../../../types/events';
import { formatEventDate, formatOptional, formatTime, formatYesNo } from '../../../utils/format';
import { DetailSection } from './DetailSection';
import { FieldList, type Field } from './FieldList';

type Props = { event: EventDetail };

/** Page title + every scalar field of the event, grouped into short details and free-text notes. */
export function EventSummary({ event }: Props) {
  const details: Field[] = [
    ['Event #', String(event.id)],
    ['Function', formatOptional(event.function_type)],
    ['Guests', formatOptional(event.guest_count)],
    ['Weather', formatOptional(event.weather)],
    ['Scheduled boarding', formatTime(event.boarding_time)],
    ['Actual boarding', formatTime(event.actual_boarding)],
    ['Actual departure', formatTime(event.actual_departure)],
    ['Cruising time', formatTime(event.cruising_time)],
    ['Extra time', formatTime(event.extra_time)],
    ['Water taxi', formatOptional(event.water_taxi)],
    ['Floor plan followed', formatYesNo(event.floor_plan_followed)],
    ['DJ', formatOptional(event.dj)],
  ];

  const notes: Field[] = [
    ['Feedback', formatOptional(event.feedback)],
    ['DJ feedback', formatOptional(event.dj_feedback)],
    ['Damages', formatOptional(event.damages)],
    ['Lost and found', formatOptional(event.lost_and_found)],
    ['Food notes', formatOptional(event.food_explain)],
    ['Other', formatOptional(event.other)],
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{formatEventDate(event.event_date)}</h1>
        <p className="text-slate-600">{event.client_name}</p>
      </header>
      <DetailSection title="Details">
        <FieldList fields={details} />
      </DetailSection>
      <DetailSection title="Notes">
        <FieldList fields={notes} />
      </DetailSection>
    </div>
  );
}
