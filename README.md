# Cruise Report System

A full-stack application to digitize and analyze cruise sales reports (previously tracked via Excel).
Built as a learning project covering **Python, React, TypeScript, Docker, and GitHub**.

## 📌 Project Goals

- Import historical Excel (`.xls`) cruise report files into a structured database
- Provide a local web UI for:
  - Uploading/importing new Excel reports
  - Viewing analytics & charts (sales per deck, per bartender, per event, etc.)
- Fully containerized with Docker (backend, frontend, database)

## 🏗️ Architecture

```text
cruise-report-system/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── imports.py      # POST /api/imports
│   │   │       ├── clients.py      # GET /api/clients
│   │   │       └── events.py       # GET /api/events (paginated, filters) + GET /api/events/{id}
│   │   ├── schemas/
│   │   │   ├── imports.py          # Pydantic response models (API contract)
│   │   │   ├── clients.py          # ClientOut
│   │   │   └── events.py           # EventListItem, EventListPage, EventDetail (+ nested row models)
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   ├── importer/               # Excel import pipeline
│   │   │   ├── parser.py           # .xls parsing (xlrd): pure functions, no DB access
│   │   │   ├── loader.py           # get-or-create + insert helpers (DB-facing, never commits)
│   │   │   ├── service.py          # import_workbook(): single transaction boundary
│   │   │   └── run_import.py       # CLI entrypoint
│   │   ├── sample_data/            # sample .xls files for local import testing (gitignored)
│   │   ├── errors.py               # UnhandledErrorMiddleware: JSON 500 + ref ID, CORS-safe
│   │   ├── main.py                 # FastAPI app + middleware (errors, CORS) + routers
│   │   ├── config.py               # Settings (env vars, CORS origins)
│   │   └── database.py
│   ├── alembic/                    # DB migrations
│   ├── alembic.ini
│   ├── tests/
│   │   ├── conftest.py             # in-memory SQLite session + api_client (get_db override)
│   │   ├── test_cors.py            # CORS allow/deny tests
│   │   ├── test_errors.py          # unhandled errors: JSON 500, ref ID, CORS headers
│   │   ├── test_clients.py         # GET /api/clients: shape, counts, sorting
│   │   ├── test_events.py          # GET /api/events: filters, pagination, sorting, totals, 422s
│   │   ├── test_event_detail.py    # GET /api/events/{id}: nested shape, totals, 404/422
│   │   ├── importer/
│   │   │   ├── test_parser.py      # pure-function unit tests
│   │   │   ├── test_loader.py      # get-or-create/insert DB tests
│   │   │   └── test_run_import.py  # end-to-end pipeline integration tests
│   │   └── samdata/                # .xls fixtures used by tests
│   ├── .venv/                      # local venv for IDE + hook (gitignored)
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── requirements-dev.txt        # -r requirements.txt + test tools
│   └── Dockerfile
├── frontend/                       # React + TypeScript (Vite)
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts           # getJson<T>(): generic GET, never throws (returns FetchOutcome<T>)
│   │   │   ├── validation.ts       # shared runtime type guards + error-detail helpers
│   │   │   ├── imports.ts          # uploadImport(): fetch wrapper, never throws (returns UploadOutcome)
│   │   │   ├── clients.ts          # getClients() + isClient/isClientList guards
│   │   │   └── events.ts           # getEvents(query, signal) + isEventListItem/isEventListPage guards
│   │   ├── types/
│   │   │   ├── api.ts              # FetchOutcome<T>: ok | http-error | invalid-response | network-error | aborted
│   │   │   ├── imports.ts          # hand-written mirror of the Pydantic ImportResponse
│   │   │   ├── clients.ts          # hand-written mirror of the Pydantic ClientOut
│   │   │   └── events.ts           # EventListItem/EventListPage mirrors + EventQuery (frontend request shape)
│   │   ├── hooks/
│   │   │   ├── uploadQueue.ts      # pure reducer + summary (no React)
│   │   │   ├── useUploadQueue.ts   # sequential upload loop (one request at a time)
│   │   │   ├── clientsState.ts     # pure reducer for the clients request (no React)
│   │   │   ├── useClients.ts       # loads clients: abort on unmount, stale-response guard, retry
│   │   │   ├── eventsState.ts      # pure reducer + request keys + selectEventsView (idle/loading/ok/error)
│   │   │   └── useEvents.ts        # re-fetches on query change, aborts stale requests, keeps previous rows
│   │   ├── components/
│   │   │   ├── Layout.tsx          # header + nav + <Outlet />
│   │   │   ├── NavBar.tsx
│   │   │   ├── clients/            # ClientFilter (controlled <select>: loading/error/empty/unknown id)
│   │   │   ├── events/             # EventsTable, Pagination, DateRangeFilter (presentational)
│   │   │   └── upload/             # FilePicker, YearSelect, StatusBadge, UploadResults
│   │   ├── pages/                  # UploadPage, EventsPage (filters + table + pagination via URL), NotFoundPage
│   │   ├── utils/
│   │   │   ├── uploadForm.ts       # client-side file validation, year options
│   │   │   ├── clientParam.ts      # parses ?client= from the URL (invalid → "All clients")
│   │   │   ├── dateParam.ts        # parses ?from=/?to= (invalid → no filter) + inverted-range check
│   │   │   ├── pageParam.ts        # parses ?page= (invalid → page 1)
│   │   │   ├── pagination.ts       # page math (total pages, "Showing X–Y of Z")
│   │   │   └── format.ts           # display formatting: dates, times, money, null → "—"
│   │   ├── test/                   # test setup + factories (makeFile, makeResult, makeClient,
│   │   │                           #   makeEventListItem, makeEventListPage, deferred)
│   │   ├── App.tsx                 # routes
│   │   └── main.tsx
│   ├── public/
│   ├── Dockerfile.dev              # dev server with hot reload (polling on Windows)
│   ├── eslint.config.js            # ESLint (code problems) + eslint-config-prettier
│   ├── .prettierrc.json            # Prettier (formatting)
│   ├── .prettierignore
│   ├── vite.config.ts
│   ├── tsconfig*.json
│   ├── package.json
│   └── package-lock.json           # committed: required by `npm ci` in CI
├── .github/workflows/ci.yml        # CI: backend (pytest) + frontend (lint/format/typecheck/Vitest)
├── .githooks/pre-push              # versioned pre-push hook (same checks as CI)
├── .gitattributes                  # force LF line endings, treat .xls as binary
├── docker-compose.yml
├── .env                            # local secrets (gitignored)
├── .env.example                    # template for required env vars
└── README.md
```

## 🗄️ Database Schema

- `clients`, `officers`, `decks`, `bartenders`, `registers`: lookup/reference tables (id, unique+indexed name)
- `cruise_events`: central table, one row per Excel file (event_date, client_id, boarding_time, actual_boarding, actual_departure, guest_count, water_taxi, extra_time, weather, function_type, damages, floor_plan_followed, dj, dj_feedback, lost_and_found, feedback, food_explain, other)
- `cruise_event_officers`: join table (event_id, officer_id, position)
- `bar_summaries`: linked to cruise_events, bartenders, decks, registers (gross_sales, tip_out currently populated by the importer; house_sales, ticket_sales, account_sales, tickets_tape/actual/diff, alcohol_qty/value, pop_juice_qty/value reserved for future parsing)
- `food_reports`: linked to cruise_events and optionally clients
- `security_incidents`: linked to cruise_events

### Table Relationships

Child tables `bar_summaries`, `cruise_event_officers`, `food_reports`, `security_incidents` all use `ondelete="CASCADE"` on their `event_id` foreign key. Deleting a `cruise_event` cascades to these rows automatically.

Non-cascading FKs: `cruise_events.client_id`, `food_reports.client_id`, `registers.deck_id`, and `bar_summaries.{bartender_id, deck_id, register_id}`. Deleting a client, deck, bartender, or register will not cascade-delete related events/summaries.

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- PyCharm Community Edition (for local dev)
- Python 3.11+ (if you want to run backend tools outside Docker, e.g. for IDE autocomplete)
- Node.js 22 (for running frontend tooling and the pre-push hook on the host)
- Git Bash on Windows (for the shell commands and the git hook)

### 1. Environment variables
Copy the example file and adjust values if needed:
```bash
cp .env.example .env
```

.env (root, used by Docker Compose and injected into containers):
```bash
POSTGRES_USER=cruise_user
POSTGRES_PASSWORD=cruise_pass
POSTGRES_DB=cruise_db
POSTGRES_PORT=5432
POSTGRES_HOST=db
```
> **Note:** .env must live in the project root (same folder as docker-compose.yml), not in backend/, since Compose needs it for ${VAR} substitution.

Optional: override allowed CORS origins (JSON list). Defaults to `["http://localhost:5173"]`:
```bash
CORS_ORIGINS='["http://localhost:5173"]'
```

### 2. Run the full stack
```bash
docker compose up -d --build
docker compose run --rm backend alembic upgrade head
```

This starts:
- db: PostgreSQL database
- backend: FastAPI application (http://localhost:8000)
- frontend: Vite dev server with hot reload (http://localhost:5173)

Interactive API docs (Swagger UI): **http://localhost:8000/docs**

Stop everything:
```bash
docker compose down
```

Stop and wipe the database volume (fresh start; re-run `alembic upgrade head` afterwards):
```bash
docker compose down -v
```

> **Note:** Python dependencies are baked into the image. After editing `requirements.txt`, rebuild with `docker compose build backend`.

> **Note:** After changing `frontend/package.json`, rebuild and refresh the container's `node_modules` volume:
> ```bash
> docker compose up -d --build -V frontend
> ```

### 3. Enable the git hook (once per clone)
```bash
git config core.hooksPath .githooks
```
See [Code Quality & CI](#-code-quality--ci).

## 🐍 Local Python Environment (optional, for IDE support)
Even though the backend runs in Docker, it's useful to have a local virtual environment so PyCharm can resolve imports, give autocomplete, etc.

From `backend/`:
```bash
python -m venv .venv
```

Activate it:
- Windows (PowerShell): `.venv\Scripts\Activate.ps1`
- Windows (cmd): `.venv\Scripts\activate.bat`
- Git Bash: `source .venv/Scripts/activate`
- macOS/Linux: `source .venv/bin/activate`

Install dependencies locally:
```bash
pip install -r requirements-dev.txt
```

PyCharm interpreter: `File → Settings → Project → Python Interpreter → Add Interpreter → Existing → backend/.venv/Scripts/python.exe`

> **Note:** This venv is used for IDE tooling, running tests, and the pre-push hook. The app itself runs in Docker.

## 🧪 Tests
Backend tests use a fresh in-memory SQLite database per test (see `tests/conftest.py`), so they don't touch the Postgres data. Route tests use the `api_client` fixture, which overrides `get_db` so the API reads the same session the test seeded.
From `backend/` with the local venv:
```bash
pytest
```

> **Note:** pytest is a dev dependency and is **not** installed in the backend Docker image, so `docker compose exec backend pytest` won't work. That's intentional: test tools stay out of the runtime image.

### Frontend

Vitest + React Testing Library, running in jsdom. From `frontend/`, on the host:
```bash
npm test              # run once (used by CI and the pre-push hook)
npm run test:watch    # re-run on save while developing
```

- Pure logic (reducer, validation, API response parsing) is tested with plain function calls.
- Components are tested the way a user sees them: queries by role/label, clicks via user-event.
- The upload function is injected (<UploadPage upload={fakeUpload} />), so no test hits the network.
- Hooks take an injectable fetch function (`useClients(fakeFetch)`). Tests use `deferred()` to freeze requests in flight and check aborts, retries and stale responses.
- `EventsPage.test.tsx` is a small integration test: it stubs only the global `fetch` and runs the real `useClients` → `getClients` → `getJson` chain inside a `MemoryRouter`.

## ⚛️ Frontend

React + TypeScript app built with Vite, in `frontend/`. It runs in Docker with hot reload (`WATCH_POLLING=true` is needed on Windows because file-change events don't cross the bind mount).

- Dev server: http://localhost:5173
- API base URL: `VITE_API_BASE_URL` (set in `docker-compose.yml`). The **browser** calls the API, so this is `http://localhost:8000`, not `http://backend:8000`.
- The backend allows this origin through CORS (`cors_origins` in `config.py`).

Useful commands (from `frontend/`, on the host):
```bash
npm run lint           # ESLint: code problems
npm run format         # Prettier: fix formatting
npm run format:check   # Prettier: report only (used by CI)
npm run build          # tsc type-check + production build
npm test
```

> **Note:** The Vite dev server does **not** type-check. Type errors only show up in `npm run build`, CI, and the pre-push hook.

### Upload page (`/upload`)

- Select one or more `.xls` files. `.xlsx`, other extensions, empty files and files over 10 MB are rejected in the browser with a reason (the backend validates again).
- **Choose the year explicitly.** Source files contain no year, and a wrong year is *not* caught by deduplication. A warning appears when the selected year isn't the current one.
- Files upload **sequentially** (one request at a time), each with its own status: Waiting → Uploading… → Imported / Skipped / Error.
- Each row shows event #, date, client, message, warnings, and the server reference ID for unexpected errors.
- A summary line counts imported / skipped / errors.

Why sequential: it gives a predictable order, simple per-file progress, and doesn't overload the backend or the DB with parallel transactions.

### Events page (`/events`)

- The client list is loaded once from `GET /api/clients`, shown as `name (event_count)`, with an **All clients** option.
- The selection lives in the URL (`/events?client=3`), so it survives refresh, bookmarks and sharing. Other query params are kept when the client changes, and a change replaces the history entry instead of adding one.
- Loading, error (message, server reference ID, **Retry** button) and empty ("no clients yet") states are shown in place of the list.
- A malformed `?client=` value (`abc`, `-1`, `1.5`) is treated as **All clients**. A well-formed ID that matches no client (e.g. `?client=999`) stays selected and is flagged as an unknown client.

### Data fetching

Plain `fetch` + custom hooks (no data-fetching library yet):

- `getJson<T>(path, isValid, { signal })` never throws. It returns a `FetchOutcome<T>`, and the body is validated at runtime by a type guard, since TypeScript types disappear at runtime.
- Hooks split a **pure reducer** (testable without React) from the **effect** (`useEffect` + `AbortController`). The cleanup aborts the request on unmount or retry, and responses that arrive after an abort are ignored. This also covers React StrictMode's double effect in development.
- Components are presentational. `ClientFilter` receives `clients`, `status`, `error` and `onRetry` as props, and the page calls the hook.


## ✅ Code Quality & CI

**ESLint** checks correctness, **Prettier** handles formatting. `eslint-config-prettier` turns off ESLint's style rules so the two tools never conflict.

### GitHub Actions (`.github/workflows/ci.yml`)
Runs on pushes to `main` and on every pull request. The two jobs run in parallel:

| Job | Steps |
|-----|-------|
| Backend | `pip install -r requirements-dev.txt` → `pytest` |
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

## 🗃️ Database Migrations (Alembic)
All Alembic commands are run inside the backend container so they use the same environment/config as the running app.

#### Create a new migration after changing models

1. Make sure the db service is running:
   ```bash
   docker compose up -d db
   ```
2. Generate the migration file (autogenerate compares models vs. current DB schema):
   ```bash
   docker compose run --rm backend alembic revision --autogenerate -m "describe your change here"
   ```
3. **Review the generated file** in `backend/alembic/versions/`. Check column types, nullable flags, foreign keys, defaults, and indexes before applying. Autogenerate is a helper, not infallible.

#### Apply migrations
```bash
docker compose run --rm backend alembic upgrade head
```
Or, if the backend container is already running:
```bash
docker compose exec backend alembic upgrade head
```

#### Roll back one migration
```bash
docker compose run --rm backend alembic downgrade -1
```

#### Check current migration state
```bash
docker compose run --rm backend alembic current
```

#### View migration history
```bash
docker compose run --rm backend alembic history
```

## 🔍 Inspecting the Database
Connect to the running Postgres container:
```bash
docker compose exec db psql -U cruise_user -d cruise_db
```

Useful psql commands once connected:
```bash
\dt              -- list tables
\d table_name    -- describe a table's columns
\q               -- quit
```

## 🧰 Tech Stack
| Layer | Technology |
| ----- |------------|
| Backend | Python, FastAPI, SQLAlchemy, Pydantic |
| Migrations | Alembic |
| Database | PostgreSQL |
| Frontend | React, TypeScript, Vite, React Router, Tailwind CSS |
| Testing | pytest, Vitest, React Testing Library |
| Excel I/O | xlrd (legacy `.xls` parsing) |
| Code quality | ESLint, Prettier, pre-push hook |
| Container | Docker, Docker Compose |
| CI | GitHub Actions |

## 📥 Excel Import Pipeline

Located in `backend/app/importer/`:

- **`parser.py`**: pure parsing helpers (no DB access). Reads `.xls` sheets via `xlrd`, extracts cruise report fields, bar summary register rows, and officer names/positions from fixed cell references.
- **`loader.py`**: DB-facing helpers: get-or-create for `clients`, `officers`, `bartenders`, `decks`, `registers`; duplicate-check via `event_exists(event_date, client_id)`; insert helpers for `cruise_events`, `cruise_event_officers`, `bar_summaries`. Never commits.
- **`service.py`**: `import_workbook(db, workbook, year, source)` is the **single transaction boundary** and the only place that calls `db.commit()`. It returns an `ImportResult` (status, event_id, event_date, client_name, message, warnings) and never raises for expected problems.
- **`run_import.py`**: CLI entrypoint that walks a folder for `.xls` files and calls `import_workbook()` for each one.

### Design rules

- **Atomic per file:** each workbook is imported in one transaction. Any failure rolls back everything for that file (event, officers, bar summaries, and any newly created client).
- **Shared logic:** the CLI and the API call the same `import_workbook()`, so their behavior can't drift apart.
- **Deduplication:** the key is (`event_date`, `client_id`). Re-importing the same file is safe; it's reported as skipped.
- **Year is required:** the source files contain no year. A wrong year creates an event on the wrong date, and dedup will *not* catch it.

### Option A: CLI (bulk import from a folder)

```bash
docker compose run --rm backend python -m app.importer.run_import app/sample_data
```

To import from a different folder, mount it into the container (the container-side path must be absolute):
```bash
docker compose run --rm -v "$(pwd)/my_files:/app/app/import_input" backend \
  python -m app.importer.run_import app/import_input
```

The command logs a summary of imported / skipped (duplicates) / error counts per run.

### Option B: API (single file upload)

```bash
curl -i -X POST http://localhost:8000/api/imports \
  -F "file=@backend/app/sample_data/2015/Sept 6 Elite.xls" \
  -F "year=2015"
```

## 🌐 API Reference

### `POST /api/imports`

`multipart/form-data`, one file per request.

| Field  | Type | Rules                              |
|--------|------|------------------------------------|
| `file` | file | `.xls` only                        |
| `year` | int  | `2000 <= year <= current year + 1` |

Every response has the same body shape:

```json
{
  "filename": "Sept 6 Elite.xls",
  "status": "imported",
  "event_id": 1,
  "event_date": "2015-09-06",
  "client_name": "elite/christian",
  "message": null,
  "warnings": []
}
```

| HTTP  | `status`   | Meaning                                         |
|-------|------------|-------------------------------------------------|
| `201` | `imported` | Event created                                   |
| `409` | `skipped`  | Event already exists for this date and client   |
| `413` | `error`    | File larger than 10 MB                          |
| `422` | `error`    | Invalid input, or unreadable/invalid file       |
| `500` | `error`    | Unexpected failure                              |

### `GET /api/clients`

All clients, for filter dropdowns. Returns a bare JSON list (a small lookup table, never paginated).

```json
[
  { "id": 3, "name": "Carnival", "event_count": 42 },
  { "id": 7, "name": "elite/christian", "event_count": 5 }
]
```

| Field         | Type | Notes                                             |
|---------------|------|---------------------------------------------------|
| `id`          | int  | Use this value to filter events                   |
| `name`        | str  | As stored (see [Current Limitations](#️-current-limitations)) |
| `event_count` | int  | Total events for this client, **all time** (can be `0`) |

- Sorted case-insensitively by name, with `id` as a tie-breaker, so the order is deterministic.
- An empty database returns `[]` with HTTP `200`.

### `GET /api/events`

Paginated list of events, newest first, with optional client and date-range filters. All parameters are optional query-string values.

| Param       | Type               | Default | Rules / notes                                        |
|-------------|--------------------|---------|------------------------------------------------------|
| `page`      | int                | `1`     | `>= 1`                                               |
| `page_size` | int                | `25`    | `1..100`                                             |
| `client_id` | int                | —       | `>= 1`, the `id` from `GET /api/clients`             |
| `date_from` | date (`YYYY-MM-DD`) | —      | **Inclusive**: events on this day are included       |
| `date_to`   | date (`YYYY-MM-DD`) | —      | **Inclusive**: events at any time on this day are included |

Example: `GET /api/events?client_id=3&date_from=2026-06-01&date_to=2026-06-30&page=2`

```json
{
  "items": [
    {
      "id": 42,
      "event_date": "2026-06-14T19:00:00",
      "client_id": 3,
      "client_name": "Elite",
      "boarding_time": "18:30:00",
      "function_type": "Wedding",
      "guest_count": 120,
      "weather": "Clear",
      "gross_sales_total": 3450.5,
      "tip_out_total": 210.0
    }
  ],
  "total": 137,
  "page": 2,
  "page_size": 25
}
```

| Field               | Type           | Notes                                                        |
|---------------------|----------------|--------------------------------------------------------------|
| `items`             | list           | The events on this page (may be empty)                       |
| `total`             | int            | Events matching the filters **across all pages**             |
| `page`, `page_size` | int            | Echo of the values actually used (defaults applied)          |
| `client_name`       | str            | Never `null` (every event has a client)                      |
| `boarding_time`     | str \| null    | `HH:MM:SS`                                                   |
| `gross_sales_total` | number \| null | Sum of the event's `bar_summaries.gross_sales`, rounded to cents |
| `tip_out_total`     | number \| null | Sum of the event's `bar_summaries.tip_out`, rounded to cents |

- **Sort order:** `event_date` descending, then `id` descending as a tie-breaker, so rows never jump between pages.
- **Totals:** `null` means "no bar data for this event", which is deliberately different from `0` (a real zero).
- **Page past the end** (e.g. `page=99`): HTTP `200` with `items: []` and the real `total`. It is not a 404.
- **Unknown `client_id`:** HTTP `200` with `items: []` and `total: 0`.
- **Date range:** internally a half-open interval (`>= date_from 00:00` and `< the day after date_to 00:00`), so evening events on `date_to` are included. `date_to=9999-12-31` means "no upper bound".

| HTTP  | Meaning                                                                 |
|-------|-------------------------------------------------------------------------|
| `200` | Success (including empty results)                                       |
| `422` | Invalid parameter. `detail` is a **list** (FastAPI's validation format) for type/range errors, e.g. `page=0`, `page_size=101`, `date_from=2026-13-01` |
| `422` | `date_from` after `date_to`. `detail` is a **string**: `"date_from must be on or before date_to"` |
| `500` | Unexpected failure (generic message with a ref ID, see below)           |

### `GET /api/events/{id}`

One event with everything attached: bar summaries, officers, security incidents and food reports.

| Param | Type | Rules |
|-------|------|-------|
| `id`  | int (path) | `>= 1` |

Example: `GET /api/events/42`

```json
{
  "id": 42,
  "event_date": "2026-06-14T19:00:00",
  "client_id": 3,
  "client_name": "Elite",
  "boarding_time": "18:30:00",
  "actual_boarding": "18:40:00",
  "actual_departure": "19:05:00",
  "cruising_time": "03:00:00",
  "extra_time": null,
  "guest_count": 120,
  "water_taxi": null,
  "weather": "Clear",
  "function_type": "Wedding",
  "damages": null,
  "floor_plan_followed": null,
  "dj": null,
  "dj_feedback": null,
  "lost_and_found": null,
  "feedback": "Great night",
  "food_explain": null,
  "other": null,
  "gross_sales_total": 3450.5,
  "net_sales_total": 3053.54,
  "hst_total": 396.96,
  "tip_out_total": 210.0,
  "bar_summaries": [
    {
      "bartender_name": "Sam",
      "deck_name": "1st Deck",
      "register_name": "Reg 1",
      "gross_sales": 3000.0,
      "net_sales": 2654.87,
      "hst": 345.13,
      "tip_out": 200.0
    }
  ],
  "officers": [
    { "officer_name": "J. Smith", "position": "captain" }
  ],
  "security_incidents": [],
  "food_reports": []
}
```

| Field | Type | Notes |
|-------|------|-------|
| Time fields (`boarding_time`, `actual_boarding`, …) | str \| null | `HH:MM:SS` |
| `gross_sales_total`, `tip_out_total` | number \| null | Same values as in `GET /api/events` (same `SUM` rules, rounded to cents) |
| `net_sales_total` | number \| null | Gross without HST (`gross / 1.13`), rounded to cents |
| `hst_total` | number \| null | `gross - net`, computed from the **rounded** values so `net + hst == gross` on screen |
| `bar_summaries[]` | list | One row per register. Bartender, deck and register names are flattened in. Per-row money uses the same rounding rules |
| `officers[]` | list | `officer_name` + `position` (e.g. `captain`, `first_mate`) |
| `security_incidents[]` | list | Guard name + description |
| `food_reports[]` | list | `client_id` / `client_name` are **nullable**: the food client may differ from the event's client, or be unknown |

- **`null` vs `0`:** as in the list, a `null` total means "no bar data", not a real zero.
- **Empty lists** (`[]`) mean the event has no rows of that kind. They are never `null`.
- **Consistency:** the totals for an event are identical in the list and detail endpoints (a test enforces this).

| HTTP  | Meaning |
|-------|---------|
| `200` | Success |
| `404` | No event with this id. Body: `{"detail": "Event not found"}` |
| `422` | `id` is not a positive integer (`abc`, `0`, `-1`, `1.5`). `detail` is a **list** (FastAPI's validation format) |
| `500` | Unexpected failure (generic message with a ref ID, see below) |

The 404 is produced by FastAPI's `HTTPException` inside the app, so it carries CORS headers and the browser can read it. The UI shows "not found" instead of a misleading "network error".

### Error handling & security

Internal exception details (SQL, stack traces, exception text) are **never** returned to API clients. For unexpected failures, the response contains a generic message with a reference ID, e.g. `(ref: a3f9c2e1)`. The full traceback is logged server-side under the same ID:

```bash
docker compose logs backend | grep "a3f9c2e1"
```

Any unhandled exception, on any endpoint, returns:

```json
{ "detail": "Internal server error (ref: a3f9c2e1)" }
```

This response is produced by `UnhandledErrorMiddleware` (`app/errors.py`), which sits **inside** `CORSMiddleware`. That way the 500 carries CORS headers, and the browser shows the real error instead of a misleading "network error".

**Rule:** API messages are written by us, never copied from exceptions.

## 🧭 Conventions

- API endpoints are plain `def` (not `async def`). SQLAlchemy and xlrd are blocking, so FastAPI runs them in a threadpool.
- SQLAlchemy models are never returned directly; responses go through Pydantic schemas in `app/schemas/`.
- The API translates service results into its own vocabulary in one place (`_to_response` in `imports.py`). For example, the service's `skipped_duplicate` becomes the API's `skipped`.
- CORS origins come from settings (`CORS_ORIGINS`), never hard-coded in `main.py`.
- Unhandled exceptions are caught by `UnhandledErrorMiddleware`, never by `@app.exception_handler(Exception)` (Starlette runs that handler outside CORS, so the browser would hide the response).
- Middleware order matters: the **last** `add_middleware()` call is the **outermost**. `UnhandledErrorMiddleware` is added before `CORSMiddleware` so it sits inside it.
- Paginated endpoints build their `WHERE` conditions **once** (e.g. `_event_filters` in `events.py`) and reuse them for both the page query and the `COUNT` query, so `total` always matches the items.
- Child-table totals are aggregated in a subquery (`GROUP BY event_id`) **before** joining, so events are never duplicated and `LIMIT` counts events, not child rows.
- Query parameters are validated declaratively with `Annotated[..., Query(...)]`. Only rules that involve several parameters (e.g. `date_from <= date_to`) are checked by hand.
- Detail endpoints load child rows eagerly with `selectinload` (one extra query per relationship) instead of lazy loading, which would run one query per access and can fail once the session is closed.
- Nested response rows are built explicitly (e.g. `bar.bartender.name` → `bartender_name`) instead of serializing ORM objects with `from_attributes`, so flattening and rounding live in one visible place.
- Money totals follow SQL `SUM` semantics everywhere (NULLs ignored, no rows → `null`), so the list and detail endpoints never disagree.

## ⚠️ Current Limitations

- Only `gross_sales` and `tip_out` are populated on `bar_summaries`.
- `cruise_events.floor_plan_followed` and `dj` are not yet parsed and are always `NULL`.
- `food_reports` and `security_incidents` are not yet populated by the importer.
- Some client names combine several people (e.g. `elite/christian`) because of how they appear in the source files. Normalization is still to be decided. Until then, each combination is its own client: it appears as a separate entry in the client filter, and filtering by `elite` does not include `elite/christian` events.
- Client names are unique **case-sensitively**, so `Alpha` and `alpha` can exist as two clients.
- `event_count` in `GET /api/clients` is all-time. It does not follow a date-range filter.
- The client list is fetched when the Events page opens and is not refreshed automatically. After importing files that create new clients, reopen or reload the Events page to see them.
- Money columns (`gross_sales`, `tip_out`, …) are stored as `Float`, not `Numeric`. Sums can drift by fractions of a cent, so `GET /api/events` and `GET /api/events/{id}` round money to 2 decimals. Moving to `Numeric` would require a migration.
- Net sales and HST are derived from `gross_sales` with a fixed 13% HST rate (Ontario). They are not stored, and a different tax rate would need a code change.
- `event_date` is stored without a timezone and treated as local time. Date filters compare against it as-is.
- `GET /api/events` uses offset pagination (`LIMIT`/`OFFSET`), which is simple and fine for thousands of rows. Very large tables would call for keyset pagination instead.

## 📅 Project Status

- [x] Database schema design
- [x] Project scaffolding, Docker, SQLAlchemy models, Alembic init
- [x] Initial migration generated, reviewed, and applied (9 tables + alembic_version)
- [x] Excel parser (sheet → DB mapping)
- [x] Atomic per-file import (shared service for CLI + API)
- [x] `POST /api/imports` (file upload)
- [x] Frontend scaffold: Vite + React + TS in Docker with hot reload, CORS
- [x] Tooling: ESLint + Prettier, GitHub Actions CI (backend + frontend), pre-push hook
- [x] Upload page (multi-file, sequential, per-file results, year warning)
- [x] Frontend tests (Vitest + React Testing Library) in CI
- [x] Global error handling (JSON 500 with ref ID, CORS-safe)
- [x] `GET /api/clients` + client filter (URL-synced `?client=`)
- [x] `GET /api/events` + events table page
- [x] `GET /api/events/{id}` (event detail with nested bar summaries, officers, incidents, food reports)
- [ ] Analytics endpoints
- [ ] Charts & dashboards

## 📄 License
Internal / personal learning project.