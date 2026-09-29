import { useSearchParams } from 'react-router';
import { ClientFilter } from '../components/clients/ClientFilter';
import { useClients } from '../hooks/useClients';
import { CLIENT_PARAM, parseClientParam } from '../utils/clientParam';

export default function EventsPage() {
  // The URL is the source of truth: /events?client=3 survives refresh, bookmarks and Back.
  const [searchParams, setSearchParams] = useSearchParams();
  const clientId = parseClientParam(searchParams.get(CLIENT_PARAM));
  const { status, clients, error, retry } = useClients();

  function handleClientChange(nextId: number | null) {
    setSearchParams(
      (prev) => {
        // Copy, so other params (page, dates in Step 4) are kept.
        const next = new URLSearchParams(prev);
        if (nextId === null) next.delete(CLIENT_PARAM);
        else next.set(CLIENT_PARAM, String(nextId));
        return next;
      },
      // Changing a filter shouldn't add a Back-button entry for every pick.
      { replace: true },
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Events</h1>
        <p className="mt-2 text-slate-600">The events table is coming in a later step.</p>
      </div>

      <ClientFilter
        value={clientId}
        onChange={handleClientChange}
        clients={clients}
        status={status}
        error={error}
        onRetry={retry}
      />
    </section>
  );
}
