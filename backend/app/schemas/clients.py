from pydantic import BaseModel, Field


class ClientOut(BaseModel):
    """One entry of the client filter dropdown."""

    id: int
    name: str
    event_count: int = Field(ge=0, description="Total events for this client, all time")