import { useSearchParams } from 'react-router';
import { EVENTS_PAGE_SIZE } from '../api/events';
import { ClientFilter } from '../components/clients/ClientFilter';
import { DateRangeFilter } from '../components/events/DateRangeFilter';
import { EventsTable } from '../components/events/EventsTable';
import { Pagination } from '../components/events/Pagination';
import { useClients } from '../hooks/useClients';
import { useEvents } from '../hooks/useEvents';
import type { EventQuery } from '../types/events';
import { CLIENT_PARAM, parseClientParam } from '../utils/clientParam';
import { FROM_PARAM, isDateRangeInverted, parseDateParam, TO_PARAM } from '../utils/dateParam';
import { PAGE_PARAM, parsePageParam } from '../utils/pageParam';

export default function EventsPage() {
  // The URL is the source of truth: filters and page survive refresh, bookmarks and Back.
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = parseClientParam(searchParams.get(CLIENT_PARAM));
  const dateFrom = parseDateParam(searchParams.get(FROM_PARAM));
  const dateTo = parseDateParam(searchParams.get(TO_PARAM));
  const page = parsePageParam(searchParams.get(PAGE_PARAM));

  const clients = useClients();

  // Inverted range: don't ask the backend at all (DateRangeFilter explains why).
  const query: EventQuery | null = isDateRangeInverted(dateFrom, dateTo)
    ? null
    : { page, pageSize: EVENTS_PAGE_SIZE, clientId, dateFrom, dateTo };
  const events = useEvents(query);

  // Rows to show: the fresh page, or the previous one (dimmed) while the next loads.
  const data = events.status === 'ok' || events.status === 'loading' ? events.data : null;

  /** Any filter change: edit the params, go back to page 1, no Back-button entry. */
  function updateFilters(edit: (next: URLSearchParams) => void) {
    setSearchParams(
      (prev) => {
        // Copy, so params we don't touch are kept.
        const next = new URLSearchParams(prev);
        edit(next);
        next.delete(PAGE_PARAM);
        return next;
      },
      { replace: true },
    );
  }

  function setOrDelete(params: URLSearchParams, key: string, value: string | null) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }

  function goToPage(nextPage: number) {
    // No `replace`: Back should return to the previous page, like any pager.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      setOrDelete(next, PAGE_PARAM, nextPage > 1 ? String(nextPage) : null);
      return next;
    });
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Events</h1>

      <div className="flex flex-wrap items-start gap-6">
        <ClientFilter
          value={clientId}
          onChange={(id) =>
            updateFilters((p) => setOrDelete(p, CLIENT_PARAM, id === null ? null : String(id)))
          }
          clients={clients.clients}
          status={clients.status}
          error={clients.error}
          onRetry={clients.retry}
        />
        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onFromChange={(d) => updateFilters((p) => setOrDelete(p, FROM_PARAM, d))}
          onToChange={(d) => updateFilters((p) => setOrDelete(p, TO_PARAM, d))}
          onClear={() =>
            updateFilters((p) => {
              p.delete(FROM_PARAM);
              p.delete(TO_PARAM);
            })
          }
        />
      </div>

      <EventsTable
        status={events.status}
        items={data?.items ?? []}
        total={data?.total ?? 0}
        page={data?.page ?? page}
        error={events.status === 'error' ? events.error : null}
        onRetry={events.retry}
        onGoToFirstPage={() => goToPage(1)}
      />

      {data && (
        <Pagination
          page={data.page}
          pageSize={EVENTS_PAGE_SIZE}
          total={data.total}
          disabled={events.status === 'loading'}
          onPageChange={goToPage}
        />
      )}
    </section>
  );
}
