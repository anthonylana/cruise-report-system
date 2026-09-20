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
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── importer/     # Excel import pipeline
│   │   │   ├── parser.py       # .xls parsing (xlrd) — pure functions, no DB access
│   │   │   ├── loader.py       # get-or-create + insert helpers (DB-facing)
│   │   │   └── run_import.py   # CLI entrypoint
│   │   ├── main.py
│   │   ├── config.py
│   │   └── database.py
│   ├── alembic/          # DB migrations
│   ├── alembic.ini
│   ├── sample_data/      # sample .xls files for local import testing (gitignored)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/         # React + TypeScript (to be added)
├── docker-compose.yml
├── .env              # local secrets (gitignored)
├── .env.example      # template for required env vars
└── README.md
```

## 🗄️ Database Schema

- `clients`, `officers`, `decks`, `bartenders`, `registers` — lookup/reference tables (id, unique+indexed name)
- `cruise_events` — central table, one row per Excel file (event_date, client_id, boarding_time, actual_boarding, actual_departure, guest_count, water_taxi, extra_time, weather, function_type, damages, floor_plan_followed, dj, dj_feedback, lost_and_found, feedback, food_explain, other)
- `cruise_event_officers` — join table (event_id, officer_id, position)
- `bar_summaries` — linked to cruise_events, bartenders, decks, registers (gross_sales, tip_out currently populated by the importer; house_sales, ticket_sales, account_sales, tickets_tape/actual/diff, alcohol_qty/value, pop_juice_qty/value reserved for future parsing)
- `food_reports` — linked to cruise_events and optionally clients
- `security_incidents` — linked to cruise_events

### Table Relationships

Child tables `bar_summaries`, `cruise_event_officers`, `food_reports`, `security_incidents` all use `ondelete="CASCADE"` on their `event_id` foreign key — deleting a `cruise_event` cascades to these rows automatically.

Non-cascading FKs: `cruise_events.client_id`, `food_reports.client_id`, `registers.deck_id`, and `bar_summaries.{bartender_id, deck_id, register_id}` — deleting a client, deck, bartender, or register will not cascade-delete related events/summaries.

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- PyCharm Community Edition (for local dev)
- Python 3.11+ (if you want to run backend tools outside Docker, e.g. for IDE autocomplete)

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
docker compose up --build
```
This starts:
- db — PostgreSQL database
- backend — FastAPI application (http://localhost:8000)

Run in detached mode:
```bash
docker compose up -d --build
```

Stop everything:
```bash
docker compose down
```

Stop and wipe the database volume (fresh start):
```bash
docker compose down -v
```

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
- macOS/Linux:
  ```bash
  source venv/bin/activate
  ```

Install dependencies locally:
```bash
pip install -r requirements.txt
```

In PyCharm, set this venv as the project interpreter:
`
File → Settings → Project → Python Interpreter → Add Interpreter → Existing → backend/venv/Scripts/python.exe
`
> **Note:** This local venv is only for IDE tooling (autocomplete, linting). The app actually runs inside Docker containers, not this venv.

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
3. **Review the generated file** in `backend/alembic/versions/` — check column types, nullable flags, foreign keys, defaults, and indexes before applying. Autogenerate is a helper, not infallible. 

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
| Backend | Python, FastAPI, SQLAlchemy |
| Migrations | Alembic |
| Database | PostgreSQL |
| Frontend | React + TypeScript (WIP) |
| Excel I/O | xlrd (legacy `.xls` parsing) |
| Container | Docker, Docker Compose |

## 📥 Excel Import Pipeline

Located in `backend/app/importer/`:

- **`parser.py`** — pure parsing helpers (no DB access). Reads `.xls` sheets via `xlrd`, extracts cruise report fields, bar summary register rows, and officer names/positions from fixed cell references.
- **`loader.py`** — DB-facing helpers: get-or-create for `clients`, `officers`, `bartenders`, `decks`, `registers`; duplicate-check via `event_exists(event_date, client_id)`; insert helpers for `cruise_events`, `cruise_event_officers`, `bar_summaries`.
- **`run_import.py`** — CLI entrypoint that walks a folder for `.xls` files and imports each one.

### Running the importer

Place `.xls` files in `backend/sample_data/` (or any folder mounted into the container), then:

```bash
docker compose run --rm backend python -m app.importer.run_import /app/sample_data
```

To import from a different folder, mount it and point the command at it:
```bash
docker compose run --rm -v ./my_files:/app/import_input backend python -m app.importer.run_import /app/import_input
```

The command logs a summary of imported / skipped_duplicate / error counts per run.


### Current limitations

- Only `gross_sales` and `tip_out` are populated on `bar_summaries`
- `cruise_events.floor_plan_followed` and `dj` are not yet parsed and are always `NULL`.
- If bar summary parsing fails for a sheet, the cruise event and officer assignments are still committed (the import is not fully atomic per-file).
- Deduplication key is (`event_date`, `client_id`) — re-running the importer on the same files is safe and will skip already-imported events.

## 📅 Project Status

- [x] Database schema design
- [x] Project scaffolding, Docker, SQLAlchemy models, Alembic init
- [x] Initial migration generated, reviewed, and applied (9 tables + alembic_version)
- [X] Excel parser (sheet → DB mapping)
- [ ] FastAPI endpoints (import + analytics)
- [ ] React + TypeScript frontend
- [ ] Charts & dashboards

## 📄 License
Internal / personal learning project.
