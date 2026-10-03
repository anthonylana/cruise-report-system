from datetime import datetime, time

import pytest
from sqlalchemy import update

from app.models import (
    BarSummary,
    Bartender,
    Client,
    CruiseEvent,
    CruiseEventOfficer,
    Deck,
    FoodReport,
    Officer,
    Register,
    SecurityIncident,
)

URL = "/api/events"


def _url(event_id) -> str:
    return f"{URL}/{event_id}"


# ---------- helpers ----------


def _add_client(db, name: str = "Elite") -> Client:
    client = Client(name=name)
    db.add(client)
    db.commit()
    return client


def _add_event(db, client: Client, when: datetime = datetime(2026, 6, 14, 19, 0), **fields):
    event = CruiseEvent(event_date=when, client_id=client.id, **fields)
    db.add(event)
    db.commit()
    return event


@pytest.fixture
def lookups(db_session):
    """One bartender/deck/register, needed because BarSummary FKs are NOT NULL."""
    bartender, deck = Bartender(name="Sam"), Deck(name="Main")
    db_session.add_all([bartender, deck])
    db_session.flush()  # assigns deck.id for the register
    register = Register(name="R1", deck_id=deck.id)
    db_session.add(register)
    db_session.commit()
    return bartender, deck, register


def _add_bar(db, lookups, event: CruiseEvent, **fields) -> BarSummary:
    bartender, deck, register = lookups
    bar = BarSummary(
        event_id=event.id,
        bartender_id=bartender.id,
        deck_id=deck.id,
        register_id=register.id,
        **fields,
    )
    db.add(bar)
    db.commit()
    return bar


def _force_null(db, bar: BarSummary, *columns: str) -> None:
    """Store a real NULL. BarSummary(x=None) does NOT: SQLAlchemy omits None for
    columns with default=0, so the default fires and stores 0. UPDATE skips defaults."""
    db.execute(
        update(BarSummary).where(BarSummary.id == bar.id).values({c: None for c in columns})
    )
    db.commit()
    db.expire_all()  # drop cached attribute values so nothing stale is reused


# ---------- shape ----------


def test_minimal_event_shape_is_exactly_the_contract(api_client, db_session):
    elite = _add_client(db_session, "Elite")
    event = _add_event(db_session, elite)

    resp = api_client.get(_url(event.id))

    assert resp.status_code == 200
    assert resp.json() == {
        "id": event.id,
        "event_date": "2026-06-14T19:00:00",
        "client_id": elite.id,
        "client_name": "Elite",
        "boarding_time": None,
        "actual_boarding": None,
        "actual_departure": None,
        "cruising_time": None,
        "extra_time": None,
        "guest_count": None,
        "water_taxi": None,
        "weather": None,
        "function_type": None,
        "damages": None,
        "floor_plan_followed": None,
        "dj": None,
        "dj_feedback": None,
        "lost_and_found": None,
        "feedback": None,
        "food_explain": None,
        "other": None,
        "gross_sales_total": None,
        "net_sales_total": None,
        "hst_total": None,
        "tip_out_total": None,
        "officers": [],
        "security_incidents": [],
        "food_reports": [],
        "bar_summaries": [],
    }


def test_scalar_fields_are_returned(api_client, db_session):
    event = _add_event(
        db_session,
        _add_client(db_session),
        boarding_time=time(18, 30),
        actual_boarding=time(18, 45),
        actual_departure=time(19, 5),
        cruising_time=time(3, 0),
        extra_time=time(0, 30),
        guest_count=120,
        water_taxi="2 runs",
        weather="Clear",
        function_type="Wedding",
        damages="Chair broken",
        floor_plan_followed=False,
        dj="DJ Max",
        dj_feedback="Great",
        lost_and_found="Phone",
        feedback="Happy client",
        food_explain="Late buffet",
        other="n/a",
    )

    body = api_client.get(_url(event.id)).json()

    assert body["boarding_time"] == "18:30:00"
    assert body["actual_boarding"] == "18:45:00"
    assert body["actual_departure"] == "19:05:00"
    assert body["cruising_time"] == "03:00:00"
    assert body["extra_time"] == "00:30:00"
    assert body["guest_count"] == 120
    assert body["floor_plan_followed"] is False  # False is data, not "missing"
    assert body["water_taxi"] == "2 runs"
    assert body["dj"] == "DJ Max"
    assert body["other"] == "n/a"


def test_related_records_are_nested_with_names(api_client, db_session, lookups):
    elite, caterer = _add_client(db_session, "Elite"), _add_client(db_session, "Catering Co")
    event = _add_event(db_session, elite)
    captain = Officer(name="Jack")
    db_session.add(captain)
    db_session.flush()
    db_session.add_all(
        [
            CruiseEventOfficer(event_id=event.id, officer_id=captain.id, position="captain"),
            SecurityIncident(event_id=event.id, guard_name="Lee", incident_description="Fight"),
            FoodReport(event_id=event.id, client_id=caterer.id, report_type="buffet"),
            FoodReport(event_id=event.id, client_id=None, completed_by="Ann"),
        ]
    )
    db_session.commit()
    bar = _add_bar(
        db_session, lookups, event, gross_sales=113.0, tip_out=10.0, tickets_tape=50
    )

    body = api_client.get(_url(event.id)).json()

    assert body["officers"] == [
        {"officer_id": captain.id, "officer_name": "Jack", "position": "captain"}
    ]
    assert body["security_incidents"][0]["guard_name"] == "Lee"
    assert body["security_incidents"][0]["incident_description"] == "Fight"
    assert [(f["client_name"], f["report_type"]) for f in body["food_reports"]] == [
        ("Catering Co", "buffet"),
        (None, None),  # food_reports.client_id is nullable
    ]
    row = body["bar_summaries"][0]
    assert row["id"] == bar.id
    assert (row["bartender_name"], row["deck_name"], row["register_name"]) == (
        "Sam",
        "Main",
        "R1",
    )
    assert (row["gross_sales"], row["net_sales"], row["hst"]) == (113.0, 100.0, 13.0)
    assert row["tip_out"] == 10.0
    assert row["tickets_tape"] == 50


def test_children_are_ordered_by_id(api_client, db_session, lookups):
    event = _add_event(db_session, _add_client(db_session))
    first = _add_bar(db_session, lookups, event, gross_sales=1.0)
    second = _add_bar(db_session, lookups, event, gross_sales=2.0)

    rows = api_client.get(_url(event.id)).json()["bar_summaries"]

    assert [r["id"] for r in rows] == [first.id, second.id]


def test_children_of_other_events_are_not_included(api_client, db_session, lookups):
    client = _add_client(db_session)
    mine, other = _add_event(db_session, client), _add_event(db_session, client)
    _add_bar(db_session, lookups, mine, gross_sales=100.0)
    _add_bar(db_session, lookups, other, gross_sales=999.0)

    body = api_client.get(_url(mine.id)).json()

    assert len(body["bar_summaries"]) == 1
    assert body["gross_sales_total"] == 100.0


# ---------- totals & money ----------


def test_totals_sum_bar_summaries_and_split_hst(api_client, db_session, lookups):
    event = _add_event(db_session, _add_client(db_session))
    _add_bar(db_session, lookups, event, gross_sales=100.0, tip_out=5.0)
    _add_bar(db_session, lookups, event, gross_sales=13.0, tip_out=5.0)

    body = api_client.get(_url(event.id)).json()

    assert body["gross_sales_total"] == 113.0
    assert body["net_sales_total"] == 100.0
    assert body["hst_total"] == 13.0
    assert body["tip_out_total"] == 10.0


def test_none_in_constructor_is_stored_as_zero_default(api_client, db_session, lookups):
    # Documents the model behavior: missing money from the ORM becomes 0, not NULL.
    event = _add_event(db_session, _add_client(db_session))
    _add_bar(db_session, lookups, event, gross_sales=None, tip_out=None)

    body = api_client.get(_url(event.id)).json()

    assert body["bar_summaries"][0]["tip_out"] == 0.0
    assert body["tip_out_total"] == 0.0


def test_totals_ignore_nulls_like_sql_sum(api_client, db_session, lookups):
    event = _add_event(db_session, _add_client(db_session))
    _add_bar(db_session, lookups, event, gross_sales=100.0, tip_out=5.0)
    second = _add_bar(db_session, lookups, event)
    _force_null(db_session, second, "gross_sales", "tip_out")
    third = _add_bar(db_session, lookups, event)
    _force_null(db_session, third, "tip_out")

    body = api_client.get(_url(event.id)).json()

    assert body["gross_sales_total"] == 100.0  # NULL ignored, like SQL SUM
    assert body["tip_out_total"] == 5.0
    assert body["bar_summaries"][1]["gross_sales"] is None
    assert body["bar_summaries"][1]["net_sales"] is None
    assert body["bar_summaries"][1]["hst"] is None
    # and the list endpoint (real SQL SUM) agrees
    listed = api_client.get(URL).json()["items"][0]
    assert listed["gross_sales_total"] == body["gross_sales_total"]
    assert listed["tip_out_total"] == body["tip_out_total"]


def test_all_null_column_totals_null(api_client, db_session, lookups):
    event = _add_event(db_session, _add_client(db_session))
    bar = _add_bar(db_session, lookups, event, gross_sales=50.0)
    _force_null(db_session, bar, "tip_out")

    body = api_client.get(_url(event.id)).json()

    assert body["tip_out_total"] is None  # every value NULL -> NULL, like SQL SUM
    assert body["gross_sales_total"] == 50.0


def test_zero_gross_is_zero_not_null(api_client, db_session, lookups):
    event = _add_event(db_session, _add_client(db_session))
    _add_bar(db_session, lookups, event, gross_sales=0.0, tip_out=0.0)

    body = api_client.get(_url(event.id)).json()
    row = body["bar_summaries"][0]

    assert (row["gross_sales"], row["net_sales"], row["hst"]) == (0.0, 0.0, 0.0)
    assert body["gross_sales_total"] == 0.0
    assert body["net_sales_total"] == 0.0


def test_money_is_rounded_and_net_plus_hst_equals_gross(api_client, db_session, lookups):
    event = _add_event(db_session, _add_client(db_session))
    _add_bar(db_session, lookups, event, gross_sales=0.1)
    _add_bar(db_session, lookups, event, gross_sales=0.2)
    _add_bar(db_session, lookups, event, gross_sales=100.0)  # 100 / 1.13 = 88.4955...

    body = api_client.get(_url(event.id)).json()

    assert body["gross_sales_total"] == 100.3  # not 100.30000000000001
    assert round(body["net_sales_total"] + body["hst_total"], 2) == body["gross_sales_total"]
    row = body["bar_summaries"][2]
    assert (row["net_sales"], row["hst"]) == (88.5, 11.5)


def test_totals_match_the_list_endpoint(api_client, db_session, lookups):
    event = _add_event(db_session, _add_client(db_session))
    for gross, tip in [(0.1, 0.7), (0.2, None), (1234.567, 12.345)]:
        _add_bar(db_session, lookups, event, gross_sales=gross, tip_out=tip)

    detail = api_client.get(_url(event.id)).json()
    listed = api_client.get(URL).json()["items"][0]

    assert detail["gross_sales_total"] == listed["gross_sales_total"]
    assert detail["tip_out_total"] == listed["tip_out_total"]


# ---------- errors ----------


def test_unknown_id_is_404_with_message(api_client):
    resp = api_client.get(_url(999))

    assert resp.status_code == 404
    assert resp.json() == {"detail": "Event not found"}


@pytest.mark.parametrize("bad_id", ["abc", "0", "-1", "1.5"])
def test_invalid_id_is_422(api_client, bad_id):
    resp = api_client.get(_url(bad_id))

    assert resp.status_code == 422
    assert isinstance(resp.json()["detail"], list)  # FastAPI's built-in validation shape


def test_404_includes_cors_header(api_client):
    # The browser hides cross-origin errors without this, and the UI would
    # show "network error" instead of "not found".
    resp = api_client.get(_url(999), headers={"Origin": "http://localhost:5173"})

    assert resp.headers["access-control-allow-origin"] == "http://localhost:5173"