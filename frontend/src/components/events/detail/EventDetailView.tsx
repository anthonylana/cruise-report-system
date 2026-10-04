import { Link } from 'react-router';
import type { EventView } from '../../../hooks/eventState';
import { LoadErrorAlert } from '../../LoadErrorAlert';
import { BarSummariesTable } from './BarSummariesTable';
import { EventSummary } from './EventSummary';
import { FoodReportsList } from './FoodReportsList';
import { IncidentsList } from './IncidentsList';
import { OfficersList } from './OfficersList';

type Props = {
  view: EventView;
  onRetry: () => void;
};

function BackLink() {
  return (
    <Link to="/events" className="w-fit text-sm text-blue-700 hover:underline">
      ← Back to events
    </Link>
  );
}

/** Renders exactly one state of the event detail page. Presentational: the page calls useEvent. */
export function EventDetailView({ view, onRetry }: Props) {
  switch (view.status) {
    case 'loading':
      return (
        <p role="status" className="text-sm text-slate-500">
          Loading event…
        </p>
      );
    case 'idle': // malformed id in the URL: nothing was requested
    case 'not-found':
      return (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Event not found</h1>
          <p className="text-sm text-slate-600">
            This event doesn't exist. It may have been deleted, or the link is wrong.
          </p>
          <BackLink />
        </div>
      );
    case 'error':
      return (
        <div className="flex flex-col gap-3">
          <LoadErrorAlert what="the event" error={view.error} onRetry={onRetry} />
          <BackLink />
        </div>
      );
    case 'ok': {
      const event = view.data;
      return (
        <div className="flex flex-col gap-8">
          <BackLink />
          <EventSummary event={event} />
          <BarSummariesTable
            rows={event.bar_summaries}
            totals={{
              gross: event.gross_sales_total,
              net: event.net_sales_total,
              hst: event.hst_total,
              tipOut: event.tip_out_total,
            }}
          />
          <OfficersList officers={event.officers} />
          <IncidentsList incidents={event.security_incidents} />
          <FoodReportsList reports={event.food_reports} />
        </div>
      );
    }
    default: {
      const unhandled: never = view;
      return unhandled;
    }
  }
}
