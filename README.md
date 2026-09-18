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
├── backend/          # Python (FastAPI + SQLAlchemy + Alembic)
│   ├── app/
│   │   ├── models/   # SQLAlchemy ORM models
│   │   ├── main.py
│   │   └── database.py
│   ├── alembic/      # DB migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/         # React + TypeScript (to be added)
├── docker-compose.yml
└── README.md
```

## 🗄️ Database Schema

- **clients** — cruise clients and food-report clients (independent)
- **officers** — crew members (captain, mate, engineer, etc.)
- **cruise_event_officers** — junction table (per-event role assignment)
- **cruise_events** — main event record (one per Excel file)
- **security_incidents** — security guard incident logs per event
- **food_reports** — buffet/plated food reports per event
- **decks** — vessel deck lookup (1st, 2nd, 3rd, ...)
- **bartenders** — bartender lookup
- **bar_summaries** — sales breakdown per bartender/deck per event

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- PyCharm Community Edition (for local dev)

### Run the stack

```bash
docker-compose up --build
```
This will start:

db — PostgreSQL database
backend — FastAPI application (http://localhost:8000)

### Run migrations
```bash
docker-compose exec backend alembic upgrade head
```

## 🧰 Tech Stack
| Layer | Technology |
| ----- |------------|
| Backend | Python, FastAPI, SQLAlchemy |
| Migrations | Alembic |
| Database | PostgreSQL |
| Frontend | React + TypeScript (WIP) |
| Excel I/O | pandas + xlrd (.xls support) |
| Container | Docker, Docker Compose |

## 📅 Project Status

 - Database schema design
 - Project scaffolding, Docker, SQLAlchemy models, Alembic init
 - Excel parser (sheet → DB mapping)
 - FastAPI endpoints (import + analytics)
 - React + TypeScript frontend
 - Charts & dashboards

## 📄 License
Internal / personal learning project.