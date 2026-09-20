import logging

from app.models import (
    Client,
    Officer,
    Bartender,
    Deck,
    Register,
    CruiseEvent,
    CruiseEventOfficer,
    BarSummary,
)
from sqlalchemy.orm import Session

logger = logging.getLogger("importer.loader")


def get_or_create_client(db: Session, name: str) -> Client | None:
    if not name:
        return None
    normalized = name.strip().lower()
    client = db.query(Client).filter(Client.name == normalized).first()
    if client:
        return client
    client = Client(name=normalized)
    db.add(client)
    db.flush()
    return client


def get_or_create_officer(db: Session, name: str) -> Officer | None:
    if not name:
        return None
    normalized = name.strip().lower()
    officer = db.query(Officer).filter(Officer.name == normalized).first()
    if officer:
        return officer
    officer = Officer(name=normalized)
    db.add(officer)
    db.flush()
    return officer


def get_or_create_bartender(db: Session, name: str) -> Bartender | None:
    if not name:
        return None
    normalized = name.strip().lower()
    bartender = db.query(Bartender).filter(Bartender.name == normalized).first()
    if bartender:
        return bartender
    bartender = Bartender(name=normalized)
    db.add(bartender)
    db.flush()
    return bartender


def get_or_create_deck(db: Session, deck_number: int) -> Deck:
    deck_name = str(deck_number)
    deck = db.query(Deck).filter(Deck.name == deck_name).first()
    if deck:
        return deck
    deck = Deck(name=deck_name)
    db.add(deck)
    db.flush()
    return deck


def get_or_create_register(db: Session, register_name: str, deck_id: int) -> Register:
    normalized = register_name.strip().lower()
    register = db.query(Register).filter(Register.name == normalized).first()
    if register:
        return register
    register = Register(name=normalized, deck_id=deck_id)
    db.add(register)
    db.flush()
    return register


def event_exists(db: Session, event_date, client_id: int) -> bool:
    if not event_date or not client_id:
        return False
    existing = (
        db.query(CruiseEvent)
        .filter(CruiseEvent.event_date == event_date, CruiseEvent.client_id == client_id)
        .first()
    )
    return existing is not None


def create_cruise_event(db: Session, data: dict, client_id: int) -> CruiseEvent:
    event = CruiseEvent(
        event_date=data["event_date"],
        client_id=client_id,
        boarding_time=data["boarding_time"],
        actual_boarding=data["actual_boarding"],
        actual_departure=data["actual_departure"],
        guest_count=data["guest_count"],
        water_taxi=data["water_taxi"],
        extra_time=data["extra_time"],
        weather=data["weather"],
        function_type=data["function_type"],
        damages=data["damages"],
        floor_plan_followed=None,
        dj=None,
        dj_feedback=data["dj_feedback"],
        lost_and_found=data["lost_and_found"],
        feedback=data["feedback"],
        food_explain=data["food_explain"],
        other=data["other"]
    )
    db.add(event)
    db.flush()
    return event


def attach_officers(db: Session, event: CruiseEvent, officer_names: list[str], position: str | None):
    for raw_name in officer_names:
        name = raw_name.strip()
        if not name:
            continue
        officer = get_or_create_officer(db, name)
        link = CruiseEventOfficer(
            cruise_event_id=event.id,
            officer_id=officer.id,
            position=position,
        )
        db.add(link)


def create_bar_summaries(db: Session, event: CruiseEvent, bar_rows: list[dict]):
    for row in bar_rows:
        bartender = get_or_create_bartender(db, row["bartender_name"])
        deck = get_or_create_deck(db, row["deck_number"])
        register = get_or_create_register(db, row["register_name"], deck.id)
        summary = BarSummary(
            event_id=event.id,
            bartender_id=bartender.id,
            deck_id=deck.id,
            register_id=register.id,
            gross_sales=row["gross_sales"],
            house_sales=None,
            ticket_sales=None,
            account_sales=None,
            tip_out=row["tip_out"],
            tickets_tape=None,
            tickets_actual=None,
            tickets_diff=None,
            alcohol_qty=None,
            alcohol_value=None,
            pop_juice_qty=None,
            pop_juice_value=None,
        )
        db.add(summary)