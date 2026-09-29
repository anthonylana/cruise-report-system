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
    total: int = Field(ge=0, description="Number of events matching the filters (all pages)")
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)