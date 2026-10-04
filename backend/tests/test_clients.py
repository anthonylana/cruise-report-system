from datetime import datetime

from app.models.client import Client
from app.models.cruise_event import CruiseEvent


def _add_client(db, name: str, n_events: int = 0) -> Client:
    client = Client(name=name)
    db.add(client)
    db.flush()  # assigns client.id without committing
    for day in range(1, n_events + 1):
        db.add(CruiseEvent(event_date=datetime(2025, 1, day), client_id=client.id))
    db.commit()
    return client


def test_empty_database_returns_empty_list(api_client):
    resp = api_client.get("/api/clients")

    assert resp.status_code == 200
    assert resp.json() == []


def test_response_shape_is_exactly_the_contract(api_client, db_session):
    carnival = _add_client(db_session, "Carnival", n_events=2)

    resp = api_client.get("/api/clients")

    assert resp.json() == [{"id": carnival.id, "name": "Carnival", "event_count": 2}]


def test_client_without_events_has_zero_count(api_client, db_session):
    # Guards COUNT(CruiseEvent.id): COUNT(*) with a LEFT JOIN would return 1 here.
    _add_client(db_session, "Lonely")

    resp = api_client.get("/api/clients")

    assert resp.json()[0]["event_count"] == 0


def test_counts_are_per_client(api_client, db_session):
    _add_client(db_session, "Alpha", n_events=3)
    _add_client(db_session, "Beta", n_events=1)

    counts = {
        c["name"]: c["event_count"] for c in api_client.get("/api/clients").json()
    }

    assert counts == {"Alpha": 3, "Beta": 1}


def test_sorted_case_insensitively_with_id_tiebreaker(api_client, db_session):
    _add_client(db_session, "beta")
    _add_client(db_session, "alpha")  # inserted before "Alpha", so lower id
    _add_client(db_session, "Charlie")
    _add_client(db_session, "Alpha")

    names = [c["name"] for c in api_client.get("/api/clients").json()]

    assert names == ["alpha", "Alpha", "beta", "Charlie"]


def test_get_clients_includes_cors_header(api_client):
    resp = api_client.get("/api/clients", headers={"Origin": "http://localhost:5173"})

    assert resp.headers["access-control-allow-origin"] == "http://localhost:5173"
