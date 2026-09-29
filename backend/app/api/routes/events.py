from datetime import date, datetime, time, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BarSummary, Client, CruiseEvent
from app.schemas.events import EventListItem, EventListPage

router = APIRouter(prefix="/events", tags=["events"])

PAGE_SIZE_DEFAULT = 25
PAGE_SIZE_MAX = 100


def _event_filters(client_id: int | None, date_from: date | None, date_to: date | None) -> list:
    """WHERE conditions shared by the page query and the COUNT query (they must match)."""
    conditions = []
    if client_id is not None:
        conditions.append(CruiseEvent.client_id == client_id)
    if date_from is not None:
        conditions.append(CruiseEvent.event_date >= datetime.combine(date_from, time.min))
    # date_to is inclusive for the user; event_date is a DateTime, so use a half-open
    # interval (< next midnight) to include events at e.g. 19:00 on date_to.
    # date.max has no "next day" (OverflowError), and nothing can come after it anyway.
    if date_to is not None and date_to < date.max:
        next_day = datetime.combine(date_to + timedelta(days=1), time.min)
        conditions.append(CruiseEvent.event_date < next_day)
    return conditions


def _money(value: float | None) -> float | None:
    """Round summed Float columns to cents (floats drift: 0.1 + 0.2 != 0.3)."""
    return None if value is None else round(value, 2)


@router.get("", response_model=EventListPage)
def list_events(
    db: Session = Depends(get_db),
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=PAGE_SIZE_MAX)] = PAGE_SIZE_DEFAULT,
    client_id: Annotated[int | None, Query(ge=1)] = None,
    date_from: Annotated[date | None, Query(description="Inclusive, YYYY-MM-DD")] = None,
    date_to: Annotated[date | None, Query(description="Inclusive, YYYY-MM-DD")] = None,
) -> EventListPage:
    """Events, newest first, filtered by client and/or inclusive date range, paginated."""
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must be on or before date_to")

    conditions = _event_filters(client_id, date_from, date_to)

    # Aggregate bar summaries FIRST (one row per event), then LEFT JOIN. Joining
    # bar_summaries directly would duplicate events and break LIMIT and COUNT.
    totals = (
        select(
            BarSummary.event_id,
            func.sum(BarSummary.gross_sales).label("gross_sales_total"),
            func.sum(BarSummary.tip_out).label("tip_out_total"),
        )
        .group_by(BarSummary.event_id)
        .subquery()
    )

    page_stmt = (
        select(
            CruiseEvent.id,
            CruiseEvent.event_date,
            CruiseEvent.client_id,
            Client.name.label("client_name"),
            CruiseEvent.boarding_time,
            CruiseEvent.function_type,
            CruiseEvent.guest_count,
            CruiseEvent.weather,
            totals.c.gross_sales_total,
            totals.c.tip_out_total,
        )
        # Inner join is safe: client_id is NOT NULL.
        .join(Client, Client.id == CruiseEvent.client_id)
        .outerjoin(totals, totals.c.event_id == CruiseEvent.id)
        .where(*conditions)
        # id breaks date ties, so rows never jump between pages.
        .order_by(CruiseEvent.event_date.desc(), CruiseEvent.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = db.execute(page_stmt).all()

    count_stmt = select(func.count()).select_from(CruiseEvent).where(*conditions)
    total = db.execute(count_stmt).scalar_one()

    items = [
        EventListItem(
            id=r.id,
            event_date=r.event_date,
            client_id=r.client_id,
            client_name=r.client_name,
            boarding_time=r.boarding_time,
            function_type=r.function_type,
            guest_count=r.guest_count,
            weather=r.weather,
            gross_sales_total=_money(r.gross_sales_total),
            tip_out_total=_money(r.tip_out_total),
        )
        for r in rows
    ]
    return EventListPage(items=items, total=total, page=page, page_size=page_size)