from collections.abc import Iterable
from datetime import date, datetime, time, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.models import BarSummary, Client, CruiseEvent, CruiseEventOfficer, FoodReport
from app.schemas.events import (
    BarSummaryRow,
    EventDetail,
    EventListItem,
    EventListPage,
    FoodReportRow,
    OfficerAssignment,
    SecurityIncidentRow,
)

router = APIRouter(prefix="/events", tags=["events"])

PAGE_SIZE_DEFAULT = 25
PAGE_SIZE_MAX = 100
HST_DIVISOR = 1.13  # Ontario HST 13%: net = gross / 1.13


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


def _sum_or_none(values: Iterable[float | None]) -> float | None:
    """Python twin of SQL SUM: ignores NULLs, and is NULL when nothing is left to add.

    Keeps the detail totals identical to the list endpoint's SQL totals.
    """
    present = [v for v in values if v is not None]
    return sum(present) if present else None


def _net_and_hst(gross: float | None) -> tuple[float | None, float | None]:
    """(net, hst) in cents. hst is derived from the ROUNDED values so net + hst == gross.

    Unlike BarSummary.net_sales, a gross of 0.0 gives (0.0, 0.0), not None:
    null means "no data", 0 is a real zero.
    """
    if gross is None:
        return None, None
    gross_c = round(gross, 2)
    net_c = round(gross / HST_DIVISOR, 2)
    return net_c, round(gross_c - net_c, 2)


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


# ---------- detail ----------


def _bar_row(bar: BarSummary) -> BarSummaryRow:
    net, hst = _net_and_hst(bar.gross_sales)
    return BarSummaryRow(
        id=bar.id,
        bartender_name=bar.bartender.name,
        deck_name=bar.deck.name,
        register_name=bar.register.name,
        gross_sales=_money(bar.gross_sales),
        net_sales=net,
        hst=hst,
        house_sales=_money(bar.house_sales),
        ticket_sales=_money(bar.ticket_sales),
        account_sales=_money(bar.account_sales),
        tip_out=_money(bar.tip_out),
        tickets_tape=bar.tickets_tape,
        tickets_actual=bar.tickets_actual,
        tickets_diff=bar.tickets_diff,
        alcohol_qty=bar.alcohol_qty,
        alcohol_value=_money(bar.alcohol_value),
        pop_juice_qty=bar.pop_juice_qty,
        pop_juice_value=_money(bar.pop_juice_value),
    )


def _food_row(report: FoodReport) -> FoodReportRow:
    return FoodReportRow(
        id=report.id,
        client_id=report.client_id,
        client_name=report.client.name if report.client is not None else None,
        report_type=report.report_type,
        substitutions=report.substitutions,
        quality=report.quality,
        quantity_shortages=report.quantity_shortages,
        presentation=report.presentation,
        problems_praises=report.problems_praises,
        other=report.other,
        items_required=report.items_required,
        completed_by=report.completed_by,
    )


def _by_id(rows):
    """selectinload gives no ORDER BY guarantee; id order = import order, and is stable."""
    return sorted(rows, key=lambda row: row.id)


@router.get(
    "/{event_id}",
    response_model=EventDetail,
    responses={404: {"description": "Event not found"}},
)
def get_event(
    event_id: Annotated[int, Path(ge=1)],
    db: Session = Depends(get_db),
) -> EventDetail:
    """One event with client, officers, security incidents, food reports and bar summaries."""
    stmt = (
        select(CruiseEvent)
        .where(CruiseEvent.id == event_id)
        .options(
            # many-to-one: JOIN into the main query (cannot multiply rows)
            joinedload(CruiseEvent.client),
            # one-to-many: one extra "WHERE event_id IN (...)" query per collection,
            # with each row's many-to-one names JOINed in (no N+1)
            selectinload(CruiseEvent.bar_summaries).options(
                joinedload(BarSummary.bartender),
                joinedload(BarSummary.deck),
                joinedload(BarSummary.register),
            ),
            selectinload(CruiseEvent.officer_assignments).joinedload(CruiseEventOfficer.officer),
            selectinload(CruiseEvent.security_incidents),
            selectinload(CruiseEvent.food_reports).joinedload(FoodReport.client),
        )
    )
    event = db.execute(stmt).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    bars = _by_id(event.bar_summaries)
    gross_total = _money(_sum_or_none(b.gross_sales for b in bars))
    net_total, hst_total = _net_and_hst(gross_total)

    return EventDetail(
        id=event.id,
        event_date=event.event_date,
        client_id=event.client_id,
        client_name=event.client.name,
        boarding_time=event.boarding_time,
        actual_boarding=event.actual_boarding,
        actual_departure=event.actual_departure,
        cruising_time=event.cruising_time,
        extra_time=event.extra_time,
        guest_count=event.guest_count,
        water_taxi=event.water_taxi,
        weather=event.weather,
        function_type=event.function_type,
        damages=event.damages,
        floor_plan_followed=event.floor_plan_followed,
        dj=event.dj,
        dj_feedback=event.dj_feedback,
        lost_and_found=event.lost_and_found,
        feedback=event.feedback,
        food_explain=event.food_explain,
        other=event.other,
        gross_sales_total=gross_total,
        net_sales_total=net_total,
        hst_total=hst_total,
        tip_out_total=_money(_sum_or_none(b.tip_out for b in bars)),
        officers=[
            OfficerAssignment(
                officer_id=a.officer_id, officer_name=a.officer.name, position=a.position
            )
            for a in _by_id(event.officer_assignments)
        ],
        security_incidents=[
            SecurityIncidentRow(
                id=s.id, guard_name=s.guard_name, incident_description=s.incident_description
            )
            for s in _by_id(event.security_incidents)
        ],
        food_reports=[_food_row(f) for f in _by_id(event.food_reports)],
        bar_summaries=[_bar_row(b) for b in bars],
    )