from typing import Literal

from pydantic import BaseModel, Field

ImportStatus = Literal["imported", "skipped", "error"]


class ImportResponse(BaseModel):
    filename: str
    status: ImportStatus
    event_id: int | None = None
    event_date: str | None = None
    client_name: str | None = None
    message: str | None = None
    warnings: list[str] = Field(default_factory=list)
