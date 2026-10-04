import logging
import re

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app

ALLOWED = "http://localhost:5173"
SECRET = "db password is hunter2"  # must never reach the client
REF_PATTERN = re.compile(r"\(ref: ([0-9a-f]{8})\)")


def _exploding_db():
    raise RuntimeError(SECRET)


@pytest.fixture
def crashing_client():
    app.dependency_overrides[get_db] = _exploding_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)


def _post_valid_import(client: TestClient):
    return client.post(
        "/api/imports",
        headers={"Origin": ALLOWED},
        data={"year": "2025"},
        files={"file": ("report.xls", b"not really excel", "application/vnd.ms-excel")},
    )


def test_unhandled_error_returns_json_500_with_ref(crashing_client):
    resp = _post_valid_import(crashing_client)

    assert resp.status_code == 500
    body = resp.json()
    assert REF_PATTERN.search(body["detail"])
    assert SECRET not in resp.text


def test_unhandled_error_response_has_cors_header(crashing_client):
    resp = _post_valid_import(crashing_client)

    assert resp.status_code == 500
    assert resp.headers["access-control-allow-origin"] == ALLOWED


def test_unhandled_error_logs_traceback_with_same_ref(crashing_client, caplog):
    with caplog.at_level(logging.ERROR, logger="api.errors"):
        resp = _post_valid_import(crashing_client)

    ref = REF_PATTERN.search(resp.json()["detail"]).group(1)
    records = [r for r in caplog.records if r.name == "api.errors"]
    assert len(records) == 1
    assert ref in records[0].getMessage()
    assert records[0].exc_info is not None  # traceback was logged
    assert SECRET in str(records[0].exc_info[1])  # details stay in the logs
