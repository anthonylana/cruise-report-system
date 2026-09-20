"""
Import service: the single transaction boundary for importing one workbook.

Both the CLI (run_import.py) and the future API endpoint call
import_workbook(). It is the ONLY place that calls db.commit().
"""

import logging
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.importer.loader import (
    attach_officers,
    create_bar_summaries,
    create_cruise_event,
    event_exists,
    get_or_create_client,
)
from app.importer.parser import (
    find_sheet,
    parse_bar_summary,
    parse_cruise_report,
    parse_officers,
)

logger = logging.getLogger("importer.service")

STATUS_IMPORTED = "imported"
STATUS_SKIPPED_DUPLICATE = "skipped_duplicate"
STATUS_ERROR = "error"


@dataclass
class ImportResult:
    """Outcome of importing a single workbook."""

    status: str
    source: str
    event_id: int | None = None
    event_date: str | None = None
    client_name: str | None = None
    message: str | None = None
    warnings: list[str] = field(default_factory=list)


def import_workbook(
    db: Session,
    workbook,
    year: int,
    source: str,
) -> ImportResult:
    """
    Import one already-opened xlrd workbook inside a single transaction.

    Commits on success, rolls back on any failure. Never raises for
    expected problems - returns an ImportResult with status 'error' instead.
    """
    warnings: list[str] = []

    try:
        cruise_sheet = find_sheet(workbook, "Cruise Report", fallback_index=0)
        bar_sheet = find_sheet(workbook, "Bar Summary", fallback_index=2)

        if cruise_sheet is None:
            return ImportResult(
                status=STATUS_ERROR,
                source=source,
                message="Missing Cruise Report sheet",
            )

        cruise_data = parse_cruise_report(cruise_sheet, year, workbook)

        if not cruise_data["event_date"]:
            return ImportResult(
                status=STATUS_ERROR,
                source=source,
                message="No valid event_date could be parsed",
            )

        if not cruise_data["client_name"]:
            return ImportResult(
                status=STATUS_ERROR,
                source=source,
                message="No client name found",
            )

        client = get_or_create_client(db, cruise_data["client_name"])

        if event_exists(db, cruise_data["event_date"], client.id):
            db.rollback()  # discard the possibly-new client
            return ImportResult(
                status=STATUS_SKIPPED_DUPLICATE,
                source=source,
                event_date=str(cruise_data["event_date"]),
                client_name=cruise_data["client_name"],
                message="Event already exists for this date and client",
            )

        event = create_cruise_event(db, cruise_data, client.id)

        officer_data = parse_officers(cruise_sheet)
        for position, names in officer_data.items():
            attach_officers(db, event, names, position=position)

        if bar_sheet is None:
            warnings.append("No Bar Summary sheet found; no bar data imported")
        else:
            bar_rows = parse_bar_summary(bar_sheet)
            if not bar_rows:
                warnings.append("Bar Summary sheet contained no usable rows")
            create_bar_summaries(db, event, bar_rows)

        db.commit()

        return ImportResult(
            status=STATUS_IMPORTED,
            source=source,
            event_id=event.id,
            event_date=str(cruise_data["event_date"]),
            client_name=cruise_data["client_name"],
            warnings=warnings,
        )

    except Exception as e:
        db.rollback()
        logger.exception("[%s] Import failed", source)
        return ImportResult(
            status=STATUS_ERROR,
            source=source,
            message=f"{type(e).__name__}: {e}",
            warnings=warnings,
        )