# Backend

FastAPI backend for the Cruise Report System. It provides the import API, client/event endpoints, SQLAlchemy models, Alembic migrations, and the shared Excel import service.

## Run with Docker

From the repository root:

```bash
docker compose up -d --build db backend
docker compose run --rm backend alembic upgrade head
```

The API is available at <http://localhost:8000>; interactive Swagger UI is at <http://localhost:8000/docs>.

The backend reads database settings from the root `.env` file used by Docker Compose. That file must be beside `docker-compose.yml`:

```dotenv
POSTGRES_USER=cruise_user
POSTGRES_PASSWORD=cruise_pass
POSTGRES_DB=cruise_db
POSTGRES_PORT=5432
POSTGRES_HOST=db
```

After changing `requirements.txt`, rebuild the image:

```bash
docker compose build backend
```

## Local Python environment (optional, for IDE support)

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

## Tests

Tests use a fresh in-memory SQLite database per test. The `api_client` fixture overrides `get_db`, so route tests read the same session they seed. Tests do not touch the Postgres data.

From `backend/` with the local virtual environment active:

```bash
pytest
```

`pytest` is a development dependency and is intentionally not installed in the runtime backend image; `docker compose exec backend pytest` is therefore not expected to work.

## Package structure

```text
backend/
├── app/
│   ├── api/
│   │   └── routes/
│   │       ├── imports.py      # POST /api/imports
│   │       ├── clients.py      # GET /api/clients
│   │       └── events.py       # GET /api/events (paginated, client + date filters)
│   ├── schemas/
│   │   ├── imports.py          # Pydantic response models (API contract)
│   │   ├── clients.py          # ClientOut
│   │   └── events.py           # getEvents/getEvent + list and detail guards
│   ├── models/                 # SQLAlchemy ORM models
│   ├── importer/               # Excel import pipeline
│   │   ├── parser.py           # .xls parsing (xlrd): pure functions, no DB access
│   │   ├── loader.py           # get-or-create + insert helpers (DB-facing, never commits)
│   │   ├── service.py          # import_workbook(): single transaction boundary
│   │   └── run_import.py       # CLI entrypoint
│   ├── sample_data/            # sample .xls files for local import testing (gitignored)
│   ├── errors.py               # UnhandledErrorMiddleware: JSON 500 + ref ID, CORS-safe
│   ├── main.py                 # FastAPI app + middleware (errors, CORS) + routers
│   ├── config.py               # Settings (env vars, CORS origins)
│   └── database.py
├── alembic/                    # DB migrations
├── alembic.ini
├── tests/
│   ├── conftest.py             # in-memory SQLite session + api_client (get_db override)
│   ├── test_cors.py            # CORS allow/deny tests
│   ├── test_errors.py          # unhandled errors: JSON 500, ref ID, CORS headers
│   ├── test_clients.py         # GET /api/clients: shape, counts, sorting
│   ├── test_events.py          # GET /api/events: filters, pagination, sorting, totals, 422s
│   ├── importer/
│   │   ├── test_parser.py      # pure-function unit tests
│   │   ├── test_loader.py      # get-or-create/insert DB tests
│   │   └── test_run_import.py  # end-to-end pipeline integration tests
│   └── samdata/                # .xls fixtures used by tests
├── .venv/                      # local venv for IDE + hook (gitignored)
├── pytest.ini
├── requirements.txt
├── requirements-dev.txt        # -r requirements.txt + test tools
└── Dockerfile
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

## Excel import pipeline

The shared service is used by both the CLI and API:

- `parser.py` reads legacy `.xls` sheets with `xlrd` and returns parsed values without database access.
- `loader.py` performs get-or-create and insert operations but never commits.
- `service.py` exposes `import_workbook(db, workbook, year, source)`. It is the single transaction boundary and only location that calls `db.commit()`.
- `run_import.py` walks a folder of `.xls` files and calls the service for each file.

Design rules:

- **Atomic per file:** failure rolls back the event, officers, bar summaries, and newly created client for that file.
- **Shared behavior:** CLI and API use the same service.
- **Deduplication:** `(event_date, client_id)` identifies an existing event; re-imports are reported as skipped.
- **Required year:** source workbooks do not contain a year, and a wrong year is not caught by deduplication.

### CLI import

Use the sample data directory from the backend container:

```bash
docker compose run --rm backend python -m app.importer.run_import app/sample_data
```

To mount another host directory, use an absolute container-side path:

```bash
docker compose run --rm -v "$(pwd)/my_files:/app/app/import_input" backend \
  python -m app.importer.run_import app/import_input
```

The CLI logs imported, skipped, and error counts.

### API import

```bash
curl -i -X POST http://localhost:8000/api/imports \
  -F "file=@backend/app/sample_data/2015/Sept 6 Elite.xls" \
  -F "year=2015"
```

## API reference

### `POST /api/imports`

Accepts `multipart/form-data` with one file per request:

| Field  | Type    | Rules                              |
| ------ | ------- | ---------------------------------- |
| `file` | file    | `.xls` only                        |
| `year` | integer | `2000 <= year <= current year + 1` |

Response body shape:

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

| HTTP  | Status/meaning                                          |
| ----- | ------------------------------------------------------- |
| `201` | `imported`: event created                               |
| `409` | `skipped`: event already exists for the date and client |
| `413` | `error`: file exceeds 10 MB                             |
| `422` | `error`: invalid input or unreadable/invalid file       |
| `500` | `error`: unexpected failure                             |

### `GET /api/clients`

Returns a bare JSON list for the frontend filter. It is not paginated:

```json
[
  { "id": 3, "name": "Carnival", "event_count": 42 },
  { "id": 7, "name": "elite/christian", "event_count": 5 }
]
```

Results are sorted case-insensitively by name, with ID as tie-breaker. `event_count` is all-time and may be zero. An empty database returns `[]` with `200`.

### `GET /api/events`

Returns newest-first, paginated events. Parameters:

| Parameter   | Type         | Default/rules            |
| ----------- | ------------ | ------------------------ |
| `page`      | integer      | `1`, must be `>= 1`      |
| `page_size` | integer      | `25`, range `1..100`     |
| `client_id` | integer      | optional, must be `>= 1` |
| `date_from` | `YYYY-MM-DD` | optional, inclusive      |
| `date_to`   | `YYYY-MM-DD` | optional, inclusive      |

Example:

```text
GET /api/events?client_id=3&date_from=2026-06-01&date_to=2026-06-30&page=2
```

Response shape:

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

`total` covers all matching pages. Sorting is `event_date DESC, id DESC`. Date filtering uses an inclusive date range internally represented as a half-open interval, so events at any time on `date_to` are included. A page past the end returns `200` with an empty `items` list. An unknown client ID returns `200` with `items: []` and `total: 0`.

Money totals are rounded to cents. `null` means no bar data; it is distinct from a real zero. Invalid parameters return `422`; a reversed date range returns `422` with the message `date_from must be on or before date_to`.

### `GET /api/events/{id}`

Returns one event with nested bar summaries, officers, security incidents, and food reports. Time fields are `HH:MM:SS` strings or `null`. Empty nested collections are `[]`, never `null`.

The response includes event fields, `gross_sales_total`, `net_sales_total`, `hst_total`, `tip_out_total`, and nested rows such as:

```json
{
  "id": 42,
  "client_id": 3,
  "client_name": "Elite",
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
  "officers": [{ "officer_name": "J. Smith", "position": "captain" }],
  "security_incidents": [],
  "food_reports": []
}
```

`net_sales` is gross divided by `1.13`; HST is gross minus the rounded net value, so displayed net plus HST equals displayed gross. Food-report client IDs and names are nullable because the food client may differ from the event client.

- `200` — success.
- `404` — no event; body is `{"detail": "Event not found"}`.
- `422` — non-positive or non-integer ID.
- `500` — unexpected failure.

## Error handling and security

Unexpected exceptions never expose SQL, stack traces, or exception text. Clients receive:

```json
{ "detail": "Internal server error (ref: a3f9c2e1)" }
```

The full traceback is logged under the same reference ID:

```bash
docker compose logs backend | grep "a3f9c2e1"
```

`UnhandledErrorMiddleware` is inside `CORSMiddleware`, so JSON 500 responses include CORS headers and remain readable by the browser. API messages are authored by the application rather than copied from exceptions.

## Migrations

All Alembic commands run in the backend container:

```bash
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend alembic current
docker compose run --rm backend alembic history
docker compose run --rm backend alembic downgrade -1
```

After changing models:

```bash
docker compose up -d db
docker compose run --rm backend alembic revision --autogenerate -m "describe your change here"
```

Review the generated file in `backend/alembic/versions/` before applying it. Autogenerate is a helper, not an infallible migration review.

## Inspect Postgres

```bash
docker compose exec db psql -U cruise_user -d cruise_db
```

Inside `psql`:

```text
\dt
\d table_name
\q
```

## Conventions and limitations

- Endpoints are synchronous `def` functions because SQLAlchemy and `xlrd` are blocking; FastAPI runs them in a threadpool.
- ORM models are not returned directly; Pydantic schemas define API responses.
- Filter conditions are built once and reused for page and count queries.
- Child totals are aggregated before joining so child rows do not duplicate events.
- Detail relationships use `selectinload` rather than session-dependent lazy loading.
- Client names are case-sensitive and source-preserved, so `Alpha`, `alpha`, and combined names can be separate clients.
- The client list is not refreshed automatically after an import.
- `event_date` is timezone-naive local time.
- Offset pagination is suitable for thousands of rows; very large tables may need keyset pagination.
- Only `gross_sales` and `tip_out` are currently populated in bar summaries.
- `floor_plan_followed` and `dj` are not parsed; food reports and security incidents are not populated by the importer.
- Money uses `Float`, so API totals are rounded to two decimals. Moving to `Numeric` would require a migration.
- Net sales and HST use a fixed 13% Ontario HST rate.
- Combined client names (e.g. `elite/christian`) are separate clients: filtering by `elite` does not include `elite/christian` events. Normalization is undecided.
- `event_count` in `GET /api/clients` is all-time and ignores date filters.

## Code quality and CI

The repository CI runs backend tests with:

```text
pip install -r requirements-dev.txt → pytest
```

From `backend/`, with the development environment activated:

```bash
python -m ruff check .
python -m ruff format --check .
python -m pytest -q
```

To fix lint issues Ruff can safely fix, or to apply formatting:

```bash
python -m ruff check --fix .
python -m ruff format .
```
