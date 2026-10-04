import os

# Dummy settings so app.config.Settings() can be created without a .env file.
# Must run before anything imports `app`. Tests use SQLite, so these are never used to connect.
os.environ.setdefault("POSTGRES_USER", "test")
os.environ.setdefault("POSTGRES_PASSWORD", "test")
os.environ.setdefault("POSTGRES_DB", "test")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models
from app.database import Base, get_db
from app.main import app


@pytest.fixture
def db_session():
    """A fresh in-memory SQLite database with all tables, one per test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},  # TestClient uses another thread
        poolclass=StaticPool,  # one shared connection, so every session sees the same DB
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def api_client(db_session):
    """TestClient whose get_db yields the test's SQLite session."""

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)
