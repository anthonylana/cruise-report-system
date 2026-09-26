import logging
from datetime import date

import xlrd
from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.imports import ImportResponse
from app.importer.service import (
    STATUS_ERROR,
    STATUS_IMPORTED,
    STATUS_SKIPPED_DUPLICATE,
    ImportResult,
    import_workbook,
)

logger = logging.getLogger("api.imports")

router = APIRouter(prefix="/imports", tags=["imports"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MIN_YEAR = 2000

# service status -> (API status, HTTP code)
STATUS_MAP = {
    STATUS_IMPORTED: ("imported", status.HTTP_201_CREATED),
    STATUS_SKIPPED_DUPLICATE: ("skipped", status.HTTP_409_CONFLICT),
    STATUS_ERROR: ("error", status.HTTP_422_UNPROCESSABLE_ENTITY),
}


def _error(response: Response, filename: str, message: str,
           code: int = status.HTTP_422_UNPROCESSABLE_ENTITY) -> ImportResponse:
    response.status_code = code
    return ImportResponse(filename=filename, status="error", message=message)


@router.post(
    "",
    response_model=ImportResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"model": ImportResponse, "description": "Duplicate event (skipped)"},
        413: {"model": ImportResponse, "description": "File too large"},
        422: {"model": ImportResponse, "description": "Invalid file or year"},
    },
)
def create_import(
    response: Response,
    file: UploadFile = File(..., description="Cruise report in .xls (97-2003) format"),
    year: int = Form(..., description="Year of the event. The file only contains day and month."),
    db: Session = Depends(get_db),
) -> ImportResponse:
    filename = file.filename or "unknown.xls"

    # --- validate year (checked at request time so the upper bound never goes stale)
    max_year = date.today().year + 1
    if not MIN_YEAR <= year <= max_year:
        return _error(response, filename, f"year must be between {MIN_YEAR} and {max_year}")

    # --- validate extension
    if not filename.lower().endswith(".xls"):
        return _error(response, filename, "Only .xls (Excel 97-2003) files are accepted")

    # --- validate size: read one byte past the limit instead of trusting headers
    contents = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        return _error(response, filename, "File exceeds 10 MB limit",
                      status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

    # --- open workbook
    try:
        workbook = xlrd.open_workbook(file_contents=contents)
    except Exception as exc:  # xlrd raises several different error types for bad files
        logger.warning("[%s] Could not open workbook: %s", filename, exc)
        return _error(response, filename, "File could not be read as an .xls workbook")

    # --- run the shared service (it owns the transaction)
    try:
        result = import_workbook(db, workbook, year, filename)
    except Exception:
        logger.exception("[%s] Unexpected import failure", filename)
        return _error(response, filename, "Import failed. See server logs.")

    return _to_response(response, filename, result)


def _to_response(response: Response, filename: str, result: ImportResult) -> ImportResponse:
    """The ONLY place that translates the service's result into the API contract."""
    try:
        api_status, code = STATUS_MAP[result.status]
    except KeyError:
        # A new service status nobody mapped: fail loudly in logs, not with a KeyError 500
        logger.error("[%s] Unmapped service status: %r", filename, result.status)
        api_status, code = "error", status.HTTP_500_INTERNAL_SERVER_ERROR

    response.status_code = code
    return ImportResponse(
        filename=filename,
        status=api_status,
        event_id=result.event_id,
        event_date=result.event_date,
        client_name=result.client_name,
        message=result.message,
        warnings=result.warnings,
    )