from datetime import datetime, time

from pydantic import BaseModel, Field


class EventListItem(BaseModel):
    """One row of the events table (flat, table-friendly)."""

    id: int
    event_date: datetime
    client_id: int
    client_name: str
    boarding_time: time | None
    function_type: str | None
    guest_count: int | None
    weather: str | None
    gross_sales_total: float | None = Field(
        description="Sum of bar_summaries.gross_sales, rounded to 2 decimals; null if no bar data"
    )
    tip_out_total: float | None = Field(
        description="Sum of bar_summaries.tip_out, rounded to 2 decimals; null if no bar data"
    )


class EventListPage(BaseModel):
    """Paginated envelope for GET /api/events."""

    items: list[EventListItem]
    total: int = Field(
        ge=0, description="Number of events matching the filters (all pages)"
    )
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)


# ---------- detail (GET /api/events/{id}) ----------


class BarSummaryRow(BaseModel):
    """One bartender/register line of an event's bar report. Money rounded to 2 decimals."""

    id: int
    bartender_name: str
    deck_name: str
    register_name: str
    gross_sales: float | None
    net_sales: float | None = Field(
        description="gross_sales / 1.13 (HST removed); null if no gross"
    )
    hst: float | None = Field(description="gross_sales - net_sales; null if no gross")
    house_sales: float | None
    ticket_sales: float | None
    account_sales: float | None
    tip_out: float | None
    tickets_tape: int | None
    tickets_actual: int | None
    tickets_diff: int | None
    alcohol_qty: int | None
    alcohol_value: float | None
    pop_juice_qty: int | None
    pop_juice_value: float | None


class OfficerAssignment(BaseModel):
    officer_id: int
    officer_name: str
    position: str = Field(
        description="e.g. captain, first_mate, engineer, cruise_director"
    )


class SecurityIncidentRow(BaseModel):
    id: int
    guard_name: str
    incident_description: str | None


class FoodReportRow(BaseModel):
    id: int
    client_id: int | None = Field(
        description="Caterer; may differ from the event's client"
    )
    client_name: str | None
    report_type: str | None
    substitutions: str | None
    quality: str | None
    quantity_shortages: str | None
    presentation: str | None
    problems_praises: str | None
    other: str | None
    items_required: str | None
    completed_by: str | None


class EventDetail(BaseModel):
    """One event with every related record, for the event detail page."""

    id: int
    event_date: datetime
    client_id: int
    client_name: str

    boarding_time: time | None
    actual_boarding: time | None
    actual_departure: time | None
    cruising_time: time | None
    extra_time: time | None

    guest_count: int | None
    water_taxi: str | None
    weather: str | None
    function_type: str | None
    damages: str | None
    floor_plan_followed: bool | None
    dj: str | None
    dj_feedback: str | None
    lost_and_found: str | None
    feedback: str | None
    food_explain: str | None
    other: str | None

    gross_sales_total: float | None = Field(
        description="Sum of bar_summaries.gross_sales, rounded to 2 decimals; null if no bar data"
    )
    net_sales_total: float | None = Field(
        description="gross_sales_total / 1.13; null if no gross"
    )
    hst_total: float | None = Field(description="gross_sales_total - net_sales_total")
    tip_out_total: float | None = Field(
        description="Sum of bar_summaries.tip_out, rounded to 2 decimals; null if no bar data"
    )

    officers: list[OfficerAssignment]
    security_incidents: list[SecurityIncidentRow]
    food_reports: list[FoodReportRow]
    bar_summaries: list[BarSummaryRow]
