# Frontend

React + TypeScript application built with Vite. The frontend provides the upload workflow and event browsing UI for the Cruise Report System.

## Run with Docker

From the repository root:

```bash
docker compose up -d --build frontend
```

Open <http://localhost:5173>. The development server uses hot reload. On Windows, `WATCH_POLLING=true` is used because file-change events do not reliably cross the Docker bind mount.

The browser calls the API directly. Set `VITE_API_BASE_URL` to `http://localhost:8000` (the host-facing API URL), not `http://backend:8000` (the Docker-internal service name). The backend must allow the frontend origin through `CORS_ORIGINS`.

## Host development

From `frontend/`:

Useful commands:

```bash
npm install          # or npm ci
npm run format       # Apply Prettier formatting
npm run format:check # Check formatting without changing files
npm run lint         # Run ESLint
npm test             # Run Vitest once
npm run test:watch   # Watch tests while developing
npm run build        # Type-check and create the production build
```

The Vite dev server does not type-check by itself; type errors are caught by `npm run build`, CI, and the pre-push hook.

## Application routes

- `/upload` — select and upload one or more legacy `.xls` files.
- `/events` — browse events with client/date filters, sorting and pagination.
- `/events/:id` — one event with sales totals, bar summaries, officers, security incidents, and food reports.
- Unknown routes — rendered by `NotFoundPage`.

### Upload page

- Accepts `.xls` files only; `.xlsx`, other extensions, empty files, and files over 10 MB are rejected in the browser. The backend validates again.
- Requires an explicit year because source files do not contain a year. A warning is shown when the selected year is not the current year.
- Uploads files sequentially, one request at a time.
- Shows `Waiting`, `Uploading…`, `Imported`, `Skipped`, or `Error` per file, plus event number/date/client, messages, warnings, and unexpected-error reference IDs.
- Displays imported, skipped, and error counts.

Sequential uploads provide predictable ordering and per-file progress without overloading the backend or database with parallel transactions.

### Events page

- Loads clients from `GET /api/clients` and displays each as `name (event_count)` with an **All clients** option.
- Stores the client selection in the URL, for example `/events?client=3`, so it survives refreshes and can be bookmarked or shared.
- Preserves other query parameters when the client changes and replaces the history entry rather than adding one.
- Treats malformed client values such as `abc`, `-1`, and `1.5` as **All clients**.
- Keeps a well-formed but unknown ID such as `?client=999` selected and flags it as unknown.
- Shows loading, error/retry, and empty (`no clients yet`) states in place of the filter list.
- Filters by date range with `?from=` and `?to=` (`YYYY-MM-DD`, inclusive). Invalid dates are ignored; a reversed range is flagged and not sent.
- Paginates with `?page=` (25 rows per page). Changing a filter resets to page 1; a page past the end offers **Go to first page**.
- Sorts by clicking a column header (except `#`). The sort is stored in the URL as `?sort=<field>&dir=asc|desc`, for example `/events?sort=gross_sales_total&dir=desc`.
- Click cycle per column:
  - Numbers and money (Guests, Gross sales, Tip out): descending → ascending → default.
  - Text and times (Client, Boarding, Function, Weather): ascending → descending → default.
  - Date: the default is already newest first, so it toggles between ascending and the default.
- "Default" removes `sort` and `dir` from the URL. The default order (newest first) is shown with a muted ▼ on Date.
- Changing the sort resets to page 1, keeps the filters, and replaces the history entry, like the filters.
- Invalid or partial sort params (`?dir=desc`, `?sort=id&dir=asc`, `?sort=weather&dir=up`) fall back to the default order, so the browser never sends a request the backend would reject with `422`.
- Sorted headers expose `aria-sort` and are buttons, so they work with the keyboard and screen readers. Missing values (`—`) are always last.
- Keeps the previous rows visible (marked busy) while the next page loads.
- Each event date links to its detail page. It is a real link, so middle-click and "open in new tab" work.

### Event detail page

- Reads the id from `/events/:id`. A malformed id (`/events/abc`) shows **Event not found** without a request; a backend `404` shows the same message without **Retry**.
- Other failures show the error with its reference ID and a **Retry** button.
- Switching between ids aborts the old request and shows the loading state, so one event's data never appears under another event's URL.
- Null values render as `—`; a real zero renders as `$0.00`. Empty sections show an empty message instead of an empty table.
- A **Back to events** link returns to the list.

## Frontend structure

```text
frontend/                       # React + TypeScript (Vite)
├── src/
│   ├── api/
│   │   ├── client.ts           # getJson<T>(): generic GET, never throws (returns FetchOutcome<T>)
│   │   ├── validation.ts       # shared runtime type guards + error-detail helpers
│   │   ├── imports.ts          # uploadImport(): fetch wrapper, never throws (returns UploadOutcome)
│   │   ├── clients.ts          # getClients() + isClient/isClientList guards
│   │   └── events.ts           # getEvents/getEvent, list + detail guards, buildEventsQueryString
│   ├── types/
│   │   ├── api.ts              # FetchOutcome<T>: ok | http-error | invalid-response | network-error | aborted
│   │   ├── imports.ts          # hand-written mirror of the Pydantic ImportResponse
│   │   ├── clients.ts          # hand-written mirror of the Pydantic ClientOut
│   │   └── events.ts           # list + detail mirrors, EventQuery, EventSort (frontend request shape)
│   ├── hooks/
│   │   ├── uploadQueue.ts      # pure reducer + summary (no React)
│   │   ├── useUploadQueue.ts   # sequential upload loop (one request at a time)
│   │   ├── clientsState.ts     # pure reducer for the clients request (no React)
│   │   ├── useClients.ts       # loads clients: abort on unmount, stale-response guard, retry
│   │   ├── eventsState.ts      # list: pure reducer + eventsRequestKey (includes sort) + selectEventsView
│   │   ├── eventState.ts       # detail: pure reducer + eventRequestKey + selectEventView (404 → not-found)
│   │   ├── useEvents.ts        # re-fetches on query change, aborts stale requests, keeps previous rows
│   │   └── useEvent.ts         # loads one event by id: abort on id change, 404 → not found, retry
│   ├── components/
│   │   ├── Layout.tsx          # header + nav + <Outlet />
│   │   ├── NavBar.tsx
│   │   ├── clients/            # ClientFilter (controlled <select>: loading/error/empty/unknown id)
│   │   ├── events/             # EventsTable, Pagination, DateRangeFilter (presentational)
│   │   │   └── detail/         # EventDetailView + section components
│   │   └── upload/             # FilePicker, YearSelect, StatusBadge, UploadResults
│   ├── pages/                  # UploadPage, EventsPage, EventDetailPage, NotFoundPage
│   ├── utils/
│   │   ├── uploadForm.ts       # client-side file validation, year options
│   │   ├── clientParam.ts      # parses ?client= from the URL (invalid → "All clients")
│   │   ├── dateParam.ts        # parses ?from=/?to= (invalid → no filter) + inverted-range check
│   │   ├── eventIdParam.ts     # parses :id from the route (invalid → not found, no request)
│   │   ├── pageParam.ts        # parses ?page= (invalid → page 1)
│   │   ├── pagination.ts       # page math (total pages, "Showing X–Y of Z")
│   │   ├── sortParam.ts        # parses ?sort=/?dir= (invalid → default), writes both, click cycle (nextSort)
│   │   └── format.ts           # display formatting: dates, times, money, null → "—"
│   ├── test/                   # test setup + factories (uploads, clients, event list/detail, deferred)
│   │                           #   makeEventListItem, makeEventListPage, deferred)
│   ├── App.tsx                 # routes
│   └── main.tsx
├── public/
├── Dockerfile.dev              # dev server with hot reload (polling on Windows)
├── eslint.config.js            # ESLint (code problems) + eslint-config-prettier
├── .prettierrc.json            # Prettier (formatting)
├── .prettierignore
├── vite.config.ts
├── tsconfig*.json
├── package.json
└── package-lock.json           # committed: required by `npm ci` in CI
```

`getJson<T>()` and `uploadImport()` never throw for expected HTTP, validation, network, or abort outcomes. API bodies are checked with runtime type guards because TypeScript types are not present at runtime.

Hooks separate pure reducers from `useEffect` request orchestration. They abort requests on unmount or retry, ignore stale responses, and keep previous event rows while a changed query loads. The client filter is presentational and receives request state and retry behavior as props.

## Testing

Tests use Vitest, jsdom, and React Testing Library. Pure reducers, validation, API parsing, and pagination are tested with function calls; components are tested through accessible roles and labels. Upload tests inject a fake upload function, and hook tests inject fetch functions and use deferred requests to verify abort, retry, and stale-response behavior.

`EventsPage.test.tsx` and `EventDetailPage.test.tsx` are small integration tests: they stub only global `fetch` and run the real hook → API → `getJson` path inside a `MemoryRouter`. Components that render `<Link>` are wrapped in a `MemoryRouter`, because a link needs router context.

## API expectations

The frontend relies on these backend endpoints:

- `POST /api/imports` for one `.xls` upload and an explicit year.
- `GET /api/clients` for the client filter list.
- `GET /api/events` for filtered, paginated rows.
- `GET /api/events/{id}` for event detail data.

See the [backend API reference](../backend/README.md#api-reference) for request and response details.

## ✅ Code Quality & CI

**ESLint** checks correctness, **Prettier** handles formatting. `eslint-config-prettier` turns off ESLint's style rules so the two tools never conflict.

See [Git hook and CI](../README.md#git-hook-and-ci)

### Line endings

`.gitattributes` forces LF line endings, so Prettier and bash scripts behave the same on Windows and Linux. `.xls` files are marked binary.
