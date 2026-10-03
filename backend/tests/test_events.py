from datetime import datetime, time

import pytest

from app.models import BarSummary, Bartender, Client, CruiseEvent, Deck, Register

URL = "/api/events"


# ---------- helpers ----------


def _add_client(db, name: str = "Elite") -> Client:
    client = Client(name=name)
    db.add(client)
    db.commit()
    return client


def _add_event(db, client: Client, when: datetime, **fields) -> CruiseEvent:
    event = CruiseEvent(event_date=when, client_id=client.id, **fields)
    db.add(event)
    db.commit()
    return event


@pytest.fixture
def lookups(db_session):
    """One bartender/deck/register, needed because BarSummary FKs are NOT NULL."""
    bartender, deck = Bartender(name="Sam"), Deck(name="Main")
    db_session.add_all([bartender, deck])
    db_session.flush()  # assigns deck.id, which the register needs (registers.deck_id is NOT NULL)
    register = Register(name="R1", deck_id=deck.id)
    db_session.add(register)
    db_session.commit()
    return bartender, deck, register


def _add_bar(db, lookups, event: CruiseEvent, gross: float | None, tip: float | None) -> None:
    bartender, deck, register = lookups
    db.add(
        BarSummary(
            event_id=event.id,
            bartender_id=bartender.id,
            deck_id=deck.id,
            register_id=register.id,
            gross_sales=gross,
            tip_out=tip,
        )
    )
    db.commit()


def _ids(resp) -> list[int]:
    return [item["id"] for item in resp.json()["items"]]


# ---------- shape ----------


def test_empty_database_returns_empty_page(api_client):
    resp = api_client.get(URL)

    assert resp.status_code == 200
    assert resp.json() == {"items": [], "total": 0, "page": 1, "page_size": 25}


def test_response_shape_is_exactly_the_contract(api_client, db_session, lookups):
    elite = _add_client(db_session, "Elite")
    event = _add_event(
        db_session,
        elite,
        datetime(2026, 6, 14, 19, 0),
        boarding_time=time(18, 30),
        function_type="Wedding",
        guest_count=120,
        weather="Clear",
    )
    _add_bar(db_session, lookups, event, gross=3000.0, tip=200.0)
    _add_bar(db_session, lookups, event, gross=450.5, tip=10.0)

    resp = api_client.get(URL)

    assert resp.json() == {
        "items": [
            {
                "id": event.id,
                "event_date": "2026-06-14T19:00:00",
                "client_id": elite.id,
                "client_name": "Elite",
                "boarding_time": "18:30:00",
                "function_type": "Wedding",
                "guest_count": 120,
                "weather": "Clear",
                "gross_sales_total": 3450.5,
                "tip_out_total": 210.0,
            }
        ],
        "total": 1,
        "page": 1,
        "page_size": 25,
    }


def test_optional_fields_are_null(api_client, db_session):
    _add_event(db_session, _add_client(db_session), datetime(2026, 6, 1))

    item = api_client.get(URL).json()["items"][0]

    assert item["boarding_time"] is None
    assert item["function_type"] is None
    assert item["guest_count"] is None
    assert item["weather"] is None


# ---------- totals ----------


def test_event_without_bar_summaries_has_null_totals(api_client, db_session):
    _add_event(db_session, _add_client(db_session), datetime(2026, 6, 1))

    item = api_client.get(URL).json()["items"][0]

    # null ("no bar data") is deliberately different from 0 (a real zero).
    assert item["gross_sales_total"] is None
    assert item["tip_out_total"] is None


def test_many_bar_summaries_do_not_duplicate_events(api_client, db_session, lookups):
    # Guards the aggregate-then-join subquery: a direct JOIN would yield 3 rows here.
    event = _add_event(db_session, _add_client(db_session), datetime(2026, 6, 1))
    for _ in range(3):
        _add_bar(db_session, lookups, event, gross=100.0, tip=5.0)

    body = api_client.get(URL).json()

    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["gross_sales_total"] == 300.0
    assert body["items"][0]["tip_out_total"] == 15.0


def test_totals_are_rounded_to_cents(api_client, db_session, lookups):
    event = _add_event(db_session, _add_client(db_session), datetime(2026, 6, 1))
    _add_bar(db_session, lookups, event, gross=0.1, tip=0.1)
    _add_bar(db_session, lookups, event, gross=0.2, tip=0.2)

    item = api_client.get(URL).json()["items"][0]

    assert item["gross_sales_total"] == 0.3  # not 0.30000000000000004


# ---------- sorting & pagination ----------


def test_sorted_newest_first_with_id_tiebreaker(api_client, db_session):
    client = _add_client(db_session)
    old = _add_event(db_session, client, datetime(2026, 1, 1))
    same_a = _add_event(db_session, client, datetime(2026, 6, 1, 19, 0))
    same_b = _add_event(db_session, client, datetime(2026, 6, 1, 19, 0))  # higher id

    assert _ids(api_client.get(URL)) == [same_b.id, same_a.id, old.id]


def test_pagination_slices_and_reports_total(api_client, db_session):
    client = _add_client(db_session)
    events = [_add_event(db_session, client, datetime(2026, 6, day)) for day in range(1, 6)]
    newest_first = [e.id for e in reversed(events)]

    page1 = api_client.get(URL, params={"page": 1, "page_size": 2}).json()
    page3 = api_client.get(URL, params={"page": 3, "page_size": 2}).json()

    assert [i["id"] for i in page1["items"]] == newest_first[0:2]
    assert [i["id"] for i in page3["items"]] == newest_first[4:5]
    assert page3["total"] == 5
    assert page3["page"] == 3
    assert page3["page_size"] == 2


def test_page_past_the_end_is_empty_but_keeps_total(api_client, db_session):
    _add_event(db_session, _add_client(db_session), datetime(2026, 6, 1))

    resp = api_client.get(URL, params={"page": 99})

    assert resp.status_code == 200
    assert resp.json()["items"] == []
    assert resp.json()["total"] == 1


# ---------- filters ----------


def test_client_filter(api_client, db_session):
    elite, other = _add_client(db_session, "Elite"), _add_client(db_session, "Other")
    mine = _add_event(db_session, elite, datetime(2026, 6, 1))
    _add_event(db_session, other, datetime(2026, 6, 2))

    body = api_client.get(URL, params={"client_id": elite.id}).json()

    assert [i["id"] for i in body["items"]] == [mine.id]
    assert body["total"] == 1


def test_unknown_client_returns_empty_page_not_404(api_client, db_session):
    _add_event(db_session, _add_client(db_session), datetime(2026, 6, 1))

    resp = api_client.get(URL, params={"client_id": 999})

    assert resp.status_code == 200
    assert resp.json()["items"] == []
    assert resp.json()["total"] == 0


def test_date_range_is_inclusive_on_both_ends(api_client, db_session):
    client = _add_client(db_session)
    _add_event(db_session, client, datetime(2026, 5, 31, 23, 59))  # before
    first = _add_event(db_session, client, datetime(2026, 6, 1, 0, 0))  # from, midnight
    last = _add_event(db_session, client, datetime(2026, 6, 30, 19, 0))  # to, evening
    _add_event(db_session, client, datetime(2026, 7, 1, 0, 0))  # after

    resp = api_client.get(URL, params={"date_from": "2026-06-01", "date_to": "2026-06-30"})

    assert _ids(resp) == [last.id, first.id]
    assert resp.json()["total"] == 2


def test_same_day_range_is_allowed(api_client, db_session):
    event = _add_event(db_session, _add_client(db_session), datetime(2026, 6, 1, 19, 0))

    resp = api_client.get(URL, params={"date_from": "2026-06-01", "date_to": "2026-06-01"})

    assert _ids(resp) == [event.id]


def test_open_ended_ranges(api_client, db_session):
    client = _add_client(db_session)
    early = _add_event(db_session, client, datetime(2026, 1, 1))
    late = _add_event(db_session, client, datetime(2026, 12, 1))

    assert _ids(api_client.get(URL, params={"date_from": "2026-06-01"})) == [late.id]
    assert _ids(api_client.get(URL, params={"date_to": "2026-06-01"})) == [early.id]


def test_max_date_to_does_not_overflow(api_client, db_session):
    event = _add_event(db_session, _add_client(db_session), datetime(2026, 6, 1))

    resp = api_client.get(URL, params={"date_to": "9999-12-31"})

    assert resp.status_code == 200
    assert _ids(resp) == [event.id]


def test_total_respects_filters_across_pages(api_client, db_session):
    elite, other = _add_client(db_session, "Elite"), _add_client(db_session, "Other")
    for day in range(1, 4):
        _add_event(db_session, elite, datetime(2026, 6, day))
    _add_event(db_session, other, datetime(2026, 6, 10))

    body = api_client.get(URL, params={"client_id": elite.id, "page_size": 1}).json()

    assert len(body["items"]) == 1
    assert body["total"] == 3


# ---------- validation ----------


def test_date_from_after_date_to_is_422_with_our_message(api_client):
    resp = api_client.get(URL, params={"date_from": "2026-07-01", "date_to": "2026-06-01"})

    assert resp.status_code == 422
    assert resp.json() == {"detail": "date_from must be on or before date_to"}


@pytest.mark.parametrize(
    "params",
    [
        {"page": 0},
        {"page": "abc"},
        {"page_size": 0},
        {"page_size": 101},
        {"client_id": 0},
        {"client_id": "abc"},
        {"date_from": "2026-13-01"},
        {"date_to": "2026-02-30"},
        {"date_from": "yesterday"},
    ],
)
def test_invalid_params_are_422(api_client, params):
    resp = api_client.get(URL, params=params)

    assert resp.status_code == 422
    assert isinstance(resp.json()["detail"], list)  # FastAPI's built-in validation shape


def test_page_size_max_is_accepted(api_client):
    assert api_client.get(URL, params={"page_size": 100}).status_code == 200


def test_get_events_includes_cors_header(api_client):
    resp = api_client.get(URL, headers={"Origin": "http://localhost:5173"})

    assert resp.headers["access-control-allow-origin"] == "http://localhost:5173"