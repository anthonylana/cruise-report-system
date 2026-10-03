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
- `/events` — browse events with client/date filters and pagination.
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

## Frontend structure

```text
frontend/                       # React + TypeScript (Vite)
├── src/
│   ├── api/
│   │   ├── client.ts           # getJson<T>(): generic GET, never throws (returns FetchOutcome<T>)
│   │   ├── validation.ts       # shared runtime type guards + error-detail helpers
│   │   ├── imports.ts          # uploadImport(): fetch wrapper, never throws (returns UploadOutcome)
│   │   ├── clients.ts          # getClients() + isClient/isClientList guards
│   │   └── events.ts           # getEvents(query, signal) + isEventListItem/isEventListPage guards
│   ├── types/
│   │   ├── api.ts              # FetchOutcome<T>: ok | http-error | invalid-response | network-error | aborted
│   │   ├── imports.ts          # hand-written mirror of the Pydantic ImportResponse
│   │   ├── clients.ts          # hand-written mirror of the Pydantic ClientOut
│   │   └── events.ts           # EventListItem/EventListPage mirrors + EventQuery (frontend request shape)
│   ├── hooks/
│   │   ├── uploadQueue.ts      # pure reducer + summary (no React)
│   │   ├── useUploadQueue.ts   # sequential upload loop (one request at a time)
│   │   ├── clientsState.ts     # pure reducer for the clients request (no React)
│   │   ├── useClients.ts       # loads clients: abort on unmount, stale-response guard, retry
│   │   ├── eventsState.ts      # pure reducer + request keys + selectEventsView (idle/loading/ok/error)
│   │   └── useEvents.ts        # re-fetches on query change, aborts stale requests, keeps previous rows
│   ├── components/
│   │   ├── Layout.tsx          # header + nav + <Outlet />
│   │   ├── NavBar.tsx
│   │   ├── clients/            # ClientFilter (controlled <select>: loading/error/empty/unknown id)
│   │   ├── events/             # EventsTable, Pagination, DateRangeFilter (presentational)
│   │   └── upload/             # FilePicker, YearSelect, StatusBadge, UploadResults
│   ├── pages/                  # UploadPage, EventsPage (filters + table + pagination via URL), NotFoundPage
│   ├── utils/
│   │   ├── uploadForm.ts       # client-side file validation, year options
│   │   ├── clientParam.ts      # parses ?client= from the URL (invalid → "All clients")
│   │   ├── dateParam.ts        # parses ?from=/?to= (invalid → no filter) + inverted-range check
│   │   ├── pageParam.ts        # parses ?page= (invalid → page 1)
│   │   ├── pagination.ts       # page math (total pages, "Showing X–Y of Z")
│   │   └── format.ts           # display formatting: dates, times, money, null → "—"
│   ├── test/                   # test setup + factories (makeFile, makeResult, makeClient,
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

`EventsPage.test.tsx` is a small integration test: it stubs only global `fetch` and exercises the real `useClients` → `getClients` → `getJson` path inside a `MemoryRouter`.

## API expectations

The frontend relies on these backend endpoints:

- `POST /api/imports` for one `.xls` upload and an explicit year.
- `GET /api/clients` for the client filter list.
- `GET /api/events` for filtered, paginated rows.
- `GET /api/events/{id}` for event detail data.

See the [backend API reference](../backend/README.md#api-reference) for request and response details.

## ✅ Code Quality & CI

**ESLint** checks correctness, **Prettier** handles formatting. `eslint-config-prettier` turns off ESLint's style rules so the two tools never conflict.

### GitHub Actions (`.github/workflows/ci.yml`)

Runs on pushes to `main` and on every pull request. The two jobs run in parallel:

| Job      | Steps                                                              |
| -------- | ------------------------------------------------------------------ |
| Backend  | `pip install -r requirements-dev.txt` → `pytest`                   |
| Frontend | `npm ci` → `lint` → `format:check` → `test` → `build` (type-check) |

Older runs on the same branch are cancelled when you push again.

### Pre-push hook (`.githooks/pre-push`)

Runs the same checks locally before every `git push`: pytest (using `backend/.venv`), ESLint, Prettier check, and `tsc -b`. It skips the Vite bundle for speed.

Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

Bypass in an emergency: `git push --no-verify`

### Line endings

`.gitattributes` forces LF line endings, so Prettier and bash scripts behave the same on Windows and Linux. `.xls` files are marked binary.
