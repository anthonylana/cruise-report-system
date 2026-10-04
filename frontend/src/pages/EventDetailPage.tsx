import { useParams } from 'react-router';
import { EventDetailView } from '../components/events/detail/EventDetailView';
import { useEvent } from '../hooks/useEvent';
import { EVENT_ID_PARAM, parseEventIdParam } from '../utils/eventIdParam';

export default function EventDetailPage() {
  // Invalid id (e.g. /events/abc) -> null -> the hook doesn't fetch -> "Event not found".
  const id = parseEventIdParam(useParams()[EVENT_ID_PARAM]);
  const event = useEvent(id);

  return (
    <section className="flex flex-col gap-6">
      <EventDetailView view={event} onRetry={event.retry} />
    </section>
  );
}
