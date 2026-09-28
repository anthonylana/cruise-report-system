from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.client import Client
from app.models.cruise_event import CruiseEvent
from app.schemas.clients import ClientOut

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=list[ClientOut])
def list_clients(db: Session = Depends(get_db)) -> list[ClientOut]:
    """All clients, sorted case-insensitively by name, with their all-time event count."""
    stmt = (
        select(
            Client.id,
            Client.name,
            # COUNT(column) skips NULLs, so clients with no events get 0 (COUNT(*) would give 1).
            func.count(CruiseEvent.id).label("event_count"),
        )
        # LEFT JOIN keeps clients that have no events.
        .outerjoin(CruiseEvent, CruiseEvent.client_id == Client.id)
        .group_by(Client.id, Client.name)
        # id breaks ties (e.g. "Alpha" vs "alpha") so the order is deterministic.
        .order_by(func.lower(Client.name), Client.id)
    )
    rows = db.execute(stmt).all()
    return [ClientOut(id=r.id, name=r.name, event_count=r.event_count) for r in rows]