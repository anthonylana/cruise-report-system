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
from app.importer.loader import (
    get_or_create_client,
    event_exists,
    create_cruise_event,
    create_bar_summaries,
    attach_officers
)

from app.importer.parser import (
    extract_year_from_path,
    parse_cruise_report,
    parse_bar_summary,
    parse_officers,
    find_sheet,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("importer.run")


def find_xls_files(root: Path) -> list[Path]:
    return sorted(root.rglob("*.xls"))


def process_file(db, file_path: Path) -> str:
    """
    Returns a status string: 'imported', 'skipped_duplicate', 'error'
    """
    year = extract_year_from_path(file_path)
    if year is None:
        logger.error(f"[{file_path}] Could not determine year from path, skipping file.")
        return "error"

    try:
        workbook = xlrd.open_workbook(str(file_path))
    except Exception as e:
        logger.error(f"[{file_path}] Failed to open workbook: {e}")
        return "error"

    cruise_sheet = find_sheet(workbook, "Cruise Report", fallback_index=0)
    bar_sheet = find_sheet(workbook, "Bar Summary", fallback_index=2)

    if cruise_sheet is None:
        logger.error(f"[{file_path}] Missing Cruise Report sheet, skipping file.")
        return "error"

    try:
        cruise_data = parse_cruise_report(cruise_sheet, year)
    except Exception as e:
        logger.error(f"[{file_path}] Failed to parse Cruise Report sheet: {e}")
        return "error"

    if not cruise_data["event_date"]:
        logger.error(f"[{file_path}] No valid event_date parsed, skipping file.")
        return "error"

    if not cruise_data["client_name"]:
        logger.error(f"[{file_path}] No client name found, skipping file.")
        return "error"

    client = get_or_create_client(db, cruise_data["client_name"])

    if event_exists(db, cruise_data["event_date"], client.id):
        logger.warning(
            f"[{file_path}] Duplicate event on {cruise_data['event_date']} "
            f"for client {cruise_data['client_name']!r}, skipping."
        )
        return "skipped_duplicate"

    try:
        event = create_cruise_event(db, cruise_data, client.id)

        officer_data = parse_officers(cruise_sheet)
        for position, names in officer_data.items():
            attach_officers(db, event, names, position=position)

        if bar_sheet is not None:
            try:
                bar_rows = parse_bar_summary(bar_sheet)
                create_bar_summaries(db, event, bar_rows)
            except Exception as e:
                logger.error(f"[{file_path}] Failed to parse Bar Summary sheet: {e}")
                # Don't fail the whole event import if bar summary parsing breaks;
                # the cruise event itself is still valid.
        else:
            logger.warning(f"[{file_path}] No Bar Summary sheet found, skipping bar data.")

        db.commit()
        logger.info(
            f"[{file_path}] Imported event {cruise_data['event_date']} "
            f"for {cruise_data['client_name']!r}"
        )
        return "imported"

    except Exception as e:
        db.rollback()
        logger.error(f"[{file_path}] Failed to import: {e}")
        return "error"


def main():
    parser = argparse.ArgumentParser(description="Import legacy .xls cruise reports.")
    parser.add_argument("root_folder", type=str, help="Root folder to scan recursively for .xls files")
    args = parser.parse_args()

    root = Path(args.root_folder)
    if not root.exists() or not root.is_dir():
        logger.error(f"Root folder does not exist or is not a directory: {root}")
        sys.exit(1)

    files = find_xls_files(root)
    logger.info(f"Found {len(files)} .xls files under {root}")

    stats = {"imported": 0, "skipped_duplicate": 0, "error": 0}

    db = SessionLocal()
    try:
        for file_path in files:
            result = process_file(db, file_path)
            stats[result] += 1
    finally:
        db.close()

    logger.info(
        f"Import complete. Imported: {stats['imported']}, "
        f"Skipped (duplicates): {stats['skipped_duplicate']}, "
        f"Errors: {stats['error']}"
    )


if __name__ == "__main__":
    main()