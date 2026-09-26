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
│   │   ├── main.py
│   │   ├── config.py
│   │   └── database.py
│   ├── alembic/                    # DB migrations
│   ├── alembic.ini
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py             # temp SQLite session + sample-file fixtures
│   │   ├── importer/
│   │   │   ├── __init__.py
│   │   │   ├── test_parser.py      # pure-function unit tests
│   │   │   ├── test_loader.py      # get-or-create/insert DB tests
│   │   │   └── test_run_import.py  # end-to-end pipeline integration tests
│   │   └── samdata/
│   │       ├── sample_cruise_report_1.xls
│   │       └── sample_cruise_report_2.xls
│   ├── pytest.ini
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── Dockerfile
├── frontend/                       # React + TypeScript (to be added)
├── .github/workflows/tests.yml     # CI: runs pytest
├── .git/hooks/pre-push             # local hook (not versioned)
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
- On Windows: Git Bash for the shell commands below

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

### 2. Run the full stack
```bash
docker compose up -d --build
docker compose run --rm backend alembic upgrade head
```
This starts:
- db: PostgreSQL database
- backend: FastAPI application (http://localhost:8000)

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

## 🐍 Local Python Environment (optional, for IDE support)
Even though the backend runs in Docker, it's useful to have a local virtual environment so PyCharm can resolve imports, give autocomplete, etc.
From backend/:
```bash
python -m venv venv
```

Activate it:
- Windows (PowerShell):
  ```bash
  venv\Scripts\Activate.ps1
  ```
- Windows (cmd):
  ```bash
  venv\Scripts\activate.bat
  ```
- Git Bash / macOS / Linux:
  ```bash
  source venv/Scripts/activate   # Git Bash on Windows
  source venv/bin/activate       # macOS/Linux
  ```

Install dependencies locally:
```bash
pip install -r requirements.txt -r requirements-dev.txt
```

In PyCharm, set this venv as the project interpreter:
`File → Settings → Project → Python Interpreter → Add Interpreter → Existing → backend/venv/Scripts/python.exe`

> **Note:** This local venv is only for IDE tooling (autocomplete, linting, running tests). The app actually runs inside Docker containers, not this venv.

## 🧪 Tests
Tests use a temporary SQLite database (see `tests/conftest.py`), so they don't touch the Postgres data.

```bash
docker compose run --rm backend pytest
```
Or from the local venv in `backend/`:
```bash
pytest
```
CI runs the same suite on every push (`.github/workflows/tests.yml`).

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
| Frontend | React + TypeScript (WIP) |
| Excel I/O | xlrd (legacy `.xls` parsing) |
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
| `422` | `error`    | Invalid input, or unreadable/invalid file       |

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
- [ ] `GET /api/clients`, `GET /api/events`, `GET /api/events/{id}`
- [ ] Analytics endpoints
- [ ] React + TypeScript frontend
- [ ] Charts & dashboards

## 📄 License
Internal / personal learning project.