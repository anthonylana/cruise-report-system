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
│   │   │       └── imports.py      # POST /api/imports
│   │   ├── schemas/
│   │   │   └── imports.py          # Pydantic response models (API contract)
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   ├── importer/               # Excel import pipeline
│   │   │   ├── parser.py           # .xls parsing (xlrd): pure functions, no DB access
│   │   │   ├── loader.py           # get-or-create + insert helpers (DB-facing, never commits)
│   │   │   ├── service.py          # import_workbook(): single transaction boundary
│   │   │   └── run_import.py       # CLI entrypoint
│   │   ├── sample_data/            # sample .xls files for local import testing (gitignored)
│   │   ├── main.py                 # FastAPI app + CORS middleware
│   │   ├── config.py               # Settings (env vars, CORS origins)
│   │   └── database.py
│   ├── alembic/                    # DB migrations
│   ├── alembic.ini
│   ├── tests/
│   │   ├── conftest.py             # temp SQLite session + sample-file fixtures
│   │   ├── test_cors.py            # CORS allow/deny tests
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
│   │   │   └── imports.ts          # uploadImport(): fetch wrapper, never throws (returns UploadOutcome)
│   │   ├── types/
│   │   │   └── imports.ts          # hand-written mirror of the Pydantic ImportResponse
│   │   ├── hooks/
│   │   │   ├── uploadQueue.ts      # pure reducer + summary (no React)
│   │   │   └── useUploadQueue.ts   # sequential upload loop (one request at a time)
│   │   ├── components/
│   │   │   ├── Layout.tsx          # header + nav + <Outlet />
│   │   │   └── upload/             # FilePicker, YearSelect, StatusBadge, UploadResults
│   │   ├── pages/                  # UploadPage, EventsPage (placeholder), NotFoundPage
│   │   ├── utils/
│   │   │   └── uploadForm.ts       # client-side file validation, year options
│   │   ├── test/                   # test setup + factories (makeFile, makeResult)
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
├── .github/workflows/ci.yml        # CI: backend (pytest) + frontend (lint/format/build)
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
Backend tests use a temporary SQLite database (see `tests/conftest.py`), so they don't touch the Postgres data.

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
| `500` | `error`    | Unexpected failure (message includes a ref ID)  |

### Error handling & security

Internal exception details (SQL, stack traces, exception text) are **never** returned to API clients. For unexpected failures, the response contains a generic message with a reference ID, e.g. `(ref: a3f9c2e1)`. The full traceback is logged server-side under the same ID:

```bash
docker compose logs backend | grep "a3f9c2e1"
```

**Rule:** API messages are written by us, never copied from exceptions.

### Planned endpoints

- `GET /api/clients`: client list (for filter dropdowns)
- `GET /api/events`: paginated event list with date-range and client filters
- `GET /api/events/{id}`: event detail with bar summaries, officers, food report and incidents

## 🧭 Conventions

- API endpoints are plain `def` (not `async def`). SQLAlchemy and xlrd are blocking, so FastAPI runs them in a threadpool.
- SQLAlchemy models are never returned directly; responses go through Pydantic schemas in `app/schemas/`.
- The API translates service results into its own vocabulary in one place (`_to_response` in `imports.py`). For example, the service's `skipped_duplicate` becomes the API's `skipped`.
- CORS origins come from settings (`CORS_ORIGINS`), never hard-coded in `main.py`.

## ⚠️ Current Limitations

- Only `gross_sales` and `tip_out` are populated on `bar_summaries`.
- `cruise_events.floor_plan_followed` and `dj` are not yet parsed and are always `NULL`.
- `food_reports` and `security_incidents` are not yet populated by the importer.
- Some client names combine several people (e.g. `elite/christian`) because of how they appear in the source files. Normalization is still to be decided.

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
- [ ] `GET /api/clients` + client filter
- [ ] `GET /api/events` + events table page
- [ ] `GET /api/events/{id}` + event detail page
- [ ] Frontend tests (Vitest + React Testing Library) in CI
- [ ] Analytics endpoints
- [ ] Charts & dashboards

## 📄 License
Internal / personal learning project.