"""
CLI entrypoint for importing legacy .xls cruise report files into the DB.

Usage:
    python -m app.importer.run_import /path/to/root_folder

Or via docker compose:
    docker compose run --rm backend python -m app.importer.run_import /data/imports
"""

import argparse
import logging
import sys
from pathlib import Path

import xlrd

from app.database import SessionLocal
from app.importer.parser import extract_year_from_path
from app.importer.service import (
    STATUS_ERROR,
    STATUS_IMPORTED,
    STATUS_SKIPPED_DUPLICATE,
    ImportResult,
    import_workbook,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("importer.run")


def find_xls_files(root: Path) -> list[Path]:
    return sorted(root.rglob("*.xls"))


def import_file(db, file_path: Path) -> ImportResult:
    """Open one .xls file and hand it to the import service."""
    source = str(file_path)

    year = extract_year_from_path(file_path)
    if year is None:
        return ImportResult(
            status=STATUS_ERROR,
            source=source,
            message="Could not determine year from path",
        )

    try:
        workbook = xlrd.open_workbook(str(file_path))
    except Exception as e:
        return ImportResult(
            status=STATUS_ERROR,
            source=source,
            message=f"Failed to open workbook: {type(e).__name__}: {e}",
        )

    return import_workbook(db, workbook, year=year, source=source)


def log_result(result: ImportResult) -> None:
    if result.status == STATUS_IMPORTED:
        logger.info(
            "[%s] Imported event %s for %r (id=%s)",
            result.source,
            result.event_date,
            result.client_name,
            result.event_id,
        )
    elif result.status == STATUS_SKIPPED_DUPLICATE:
        logger.warning("[%s] %s", result.source, result.message)
    else:
        logger.error("[%s] %s", result.source, result.message)

    for warning in result.warnings:
        logger.warning("[%s] %s", result.source, warning)


def main():
    parser = argparse.ArgumentParser(description="Import legacy .xls cruise reports.")
    parser.add_argument(
        "root_folder", type=str, help="Root folder to scan recursively for .xls files"
    )
    args = parser.parse_args()

    root = Path(args.root_folder)
    if not root.exists() or not root.is_dir():
        logger.error("Root folder does not exist or is not a directory: %s", root)
        sys.exit(1)

    files = find_xls_files(root)
    logger.info("Found %d .xls files under %s", len(files), root)

    stats = {STATUS_IMPORTED: 0, STATUS_SKIPPED_DUPLICATE: 0, STATUS_ERROR: 0}

    for file_path in files:
        db = SessionLocal()
        try:
            result = import_file(db, file_path)
        finally:
            db.close()

        log_result(result)
        stats[result.status] += 1

    logger.info(
        "Import complete. Imported: %d, Skipped (duplicates): %d, Errors: %d",
        stats[STATUS_IMPORTED],
        stats[STATUS_SKIPPED_DUPLICATE],
        stats[STATUS_ERROR],
    )

    if stats[STATUS_ERROR]:
        sys.exit(1)


if __name__ == "__main__":
    main()