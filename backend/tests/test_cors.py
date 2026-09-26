from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

ALLOWED = "http://localhost:5173"


def test_preflight_from_allowed_origin():
    resp = client.options(
        "/api/imports",
        headers={"Origin": ALLOWED, "Access-Control-Request-Method": "POST"},
    )
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == ALLOWED


def test_preflight_from_unknown_origin_is_rejected():
    resp = client.options(
        "/api/imports",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in resp.headers


def test_simple_get_includes_cors_header():
    resp = client.get("/openapi.json", headers={"Origin": ALLOWED})
    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == ALLOWED
