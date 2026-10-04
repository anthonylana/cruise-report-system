# Cruise Report System

A full-stack application for importing, digitizing, and analyzing cruise sales reports that were previously tracked in Excel. It is a personal learning project built with Python, React, TypeScript, Docker, and GitHub.

## Project goals

- Import historical legacy Excel (`.xls`) cruise reports into a structured database.
- Provide a local web UI for uploading reports and browsing event data.
- Support event filtering, pagination, and future analytics such as sales by deck, bartender, and event.
- Run the backend, frontend, and database in Docker.

## Documentation

- [Frontend README](frontend/README.md) — UI behavior, development commands, tests, and client-side data fetching.
- [Backend README](backend/README.md) — API, importer, database, migrations, tests, and backend conventions.

## Architecture

```text
cruise-report-system/
├── backend/                 # FastAPI, SQLAlchemy, Alembic, importer, tests
├── frontend/                # React + TypeScript + Vite UI
├── .github/workflows/ci.yml # GitHub Actions checks
├── .githooks/pre-push       # Local checks before pushing
├── docker-compose.yml       # db, backend, and frontend services
├── .env.example             # Environment-variable template
└── README.md
```

The backend exposes the API at `http://localhost:8000`. The frontend runs at `http://localhost:5173` and calls the API from the browser, so its API base URL must use `http://localhost:8000`, not the Docker service name `http://backend:8000`.

## Prerequisites

- Docker and Docker Compose
- Python 3.11+ if running backend tools outside Docker
- Node.js 22 if running frontend tooling or the pre-push hook on the host
- Git Bash on Windows for the documented shell commands and hook
- PyCharm Community Edition is optional, but useful for local backend IDE support

## Quick start

From the repository root:

```bash
cp .env.example .env
docker compose up -d --build
docker compose run --rm backend alembic upgrade head
```

The services are then available at:

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:8000>
- Swagger UI: <http://localhost:8000/docs>

The root `.env` file is required by Docker Compose and must sit beside `docker-compose.yml`, not in `backend/`. The supplied defaults are:

```dotenv
POSTGRES_USER=cruise_user
POSTGRES_PASSWORD=cruise_pass
POSTGRES_DB=cruise_db
POSTGRES_PORT=5432
POSTGRES_HOST=db
```

Allowed CORS origins can be overridden with a JSON list:

```dotenv
CORS_ORIGINS='["http://localhost:5173"]'
```

Stop the stack:

```bash
docker compose down
```

Stop it and remove the database volume for a fresh start:

```bash
docker compose down -v
docker compose run --rm backend alembic upgrade head
```

After changing backend requirements, rebuild the backend image:

```bash
docker compose build backend
```

After changing frontend dependencies, rebuild the frontend and its `node_modules` volume:

```bash
docker compose up -d --build -V frontend
```

## Git hook and CI

Enable the versioned pre-push hook once per clone:

```bash
git config core.hooksPath .githooks
```

GitHub Actions runs on pushes to `main` and on pull requests. Its jobs run in parallel:

- **Backend:** install `requirements-dev.txt`, then run `pytest`.
- **Frontend:** `npm ci`, lint, Prettier check, Vitest, and the production build/type-check.

The pre-push hook runs the same backend and frontend checks locally, except that it skips the Vite bundle for speed. Emergency bypass:

```bash
git push --no-verify
```

## Database and data model

The database contains lookup tables (`clients`, `officers`, `decks`, `bartenders`, and `registers`), the central `cruise_events` table, and child tables for bar summaries, officers, food reports, and security incidents.

Child rows in `bar_summaries`, `cruise_event_officers`, `food_reports`, and `security_incidents` cascade when their event is deleted. Foreign keys from events and summaries to clients, decks, bartenders, and registers are non-cascading.

See the [backend README](backend/README.md) for the full schema, importer behavior, API contract, migrations, and limitations.

## Current status

Implemented:

- Database schema, Alembic migrations, Docker setup, and CI.
- Atomic per-file `.xls` importing shared by the CLI and API.
- Upload UI with sequential multi-file uploads, per-file results, and year warnings.
- Client lookup/filtering and URL-synchronized event filtering.
- Paginated event list and event detail endpoints/UI support.
- Vitest/React Testing Library coverage and CORS-safe JSON error handling with reference IDs.

Planned:

- Analytics endpoints.
- Charts and dashboards.

## Limitations

- The importer currently populates only `gross_sales` and `tip_out` in bar summaries.
- `floor_plan_followed` and `dj` are not currently parsed; food reports and security incidents are not populated by the importer.
- Client names are preserved from source files, including combined names and case-sensitive variants.
- Money is stored as `Float` and rounded to two decimals in API responses. Net sales and HST use a fixed 13% Ontario HST calculation.
- Event dates are timezone-naive local time, and event pagination uses offset pagination.
- The client list is fetched when the Events page opens and is not refreshed automatically after an import.

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
- [x] Event detail page (`/events/:id`, linked from the events table)
- [ ] Analytics endpoints
- [ ] Charts & dashboards

## 📄 License

Internal / personal learning project.
