import logging
import re
from datetime import date
from pathlib import Path

import xlrd  # legacy .xls support

logger = logging.getLogger("importer.parser")

YEAR_RE = re.compile(r"(19|20)\d{2}")

MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

REGISTER_ROWS = {
    "Reg 1": {"name": "A40", "gross": "B41", "tip": "K41", "deck": 1},
    "Reg 2": {"name": "A53", "gross": "B54", "tip": "K54", "deck": 2},
    "Reg 3": {"name": "A99", "gross": "B100", "tip": "K100", "deck": 2},
    "Reg 4": {"name": "A65", "gross": "B66", "tip": "K66", "deck": 3},
    "Reg 5": {"name": "A75", "gross": "B76", "tip": "K76", "deck": 3},
}

OFFICER_POSITIONS = {
    "K7": "Captain",
    "K8": "First Mate",
    "K9": "Engineer",
    "K10": "Cruise Director",
    "K11": "Owner",
}


def extract_year_from_path(file_path: Path) -> int | None:
    """Scan the full path for a 4-digit year folder segment, return the first found."""
    for part in file_path.parts:
        match = YEAR_RE.fullmatch(part.strip())
        if match:
            return int(part.strip())
    # fallback: search substrings in case folder name is like "2023 Season"
    for part in file_path.parts:
        match = YEAR_RE.search(part)
        if match:
            return int(match.group(0))
    return None


def parse_day_month(raw: str, year: int) -> date | None:
    """Parse strings like '4-Sep' or '15-Aug' into a date, given the year from folder."""
    if not raw or not isinstance(raw, str):
        return None
    raw = raw.strip()
    m = re.match(r"^(\d{1,2})[-\s]([A-Za-z]{3,})$", raw)
    if not m:
        logger.warning(f"Could not parse date string: {raw!r}")
        return None
    day = int(m.group(1))
    month_str = m.group(2)[:3].lower()
    month = MONTH_MAP.get(month_str)
    if not month:
        logger.warning(f"Unknown month abbreviation in: {raw!r}")
        return None
    try:
        return date(year, month, day)
    except ValueError as e:
        logger.warning(f"Invalid date {raw!r} with year {year}: {e}")
        return None


def parse_time_decimal(raw) -> float | None:
    """
    Parse values like 8, 8.45 into a float representing HH.MM as decimal hours,
    e.g. 8.45 -> 8:45 -> convert to 8.75 hours if needed downstream,
    but here we just normalize the raw decimal representation.
    Returns None if blank/unparseable.
    """
    if raw is None or raw == "":
        return None
    try:
        return float(raw)
    except (ValueError, TypeError):
        logger.warning(f"Could not parse time-like value: {raw!r}")
        return None


def parse_yes_no(raw) -> bool | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        raw = raw.strip().lower()
        if raw in ("y", "yes"):
            return True
        if raw in ("n", "no"):
            return False
    return None


def parse_officers(sheet) -> dict[str, list[str]]:
    """
    Returns {position: [name1, name2, ...]} for each of the officer cells.
    Splits on comma, strips whitespace, drops empty entries.
    """
    result = {}
    for cell_ref, position in OFFICER_POSITIONS.items():
        raw = clean_text(cell(sheet, cell_ref))
        if not raw:
            continue
        names = [n.strip() for n in raw.split(",") if n.strip()]
        if names:
            result[position] = names
    return result


def clean_text(raw) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    return text if text else None


def join_note_cells(sheet, cell_ranges: list[str]) -> str | None:
    """
    Given a list of cell ranges like ['B44:F44', 'B45:F45', ...],
    concatenate all non-empty cell values into one text blob.
    """
    lines = []
    for rng in cell_ranges:
        row_text = extract_row_range_text(sheet, rng)
        if row_text:
            lines.append(row_text)
    joined = "\n".join(lines).strip()
    return joined if joined else None


def extract_row_range_text(sheet, cell_range: str) -> str | None:
    """Extract and join text from a single-row range like 'B44:F44'."""
    start_cell, end_cell = cell_range.split(":")
    start_col, start_row = split_cell_ref(start_cell)
    end_col, end_row = split_cell_ref(end_cell)
    assert start_row == end_row, "join_note_cells only supports single-row ranges"

    values = []
    for col in range(start_col, end_col + 1):
        val = sheet.cell_value(start_row, col)
        if val not in (None, ""):
            values.append(str(val).strip())
    return " ".join(values).strip() if values else None


def split_cell_ref(ref: str) -> tuple[int, int]:
    """Convert 'B44' -> (col_index, row_index), zero-based, xlrd style."""
    match = re.match(r"^([A-Za-z]+)(\d+)$", ref)
    if not match:
        raise ValueError(f"Invalid cell reference: {ref}")
    col_letters, row_str = match.groups()
    col_index = 0
    for char in col_letters.upper():
        col_index = col_index * 26 + (ord(char) - ord("A") + 1)
    col_index -= 1
    row_index = int(row_str) - 1
    return col_index, row_index


def cell(sheet, ref: str):
    """Get raw cell value from an xlrd sheet using an A1-style reference."""
    col, row = split_cell_ref(ref)
    try:
        return sheet.cell_value(row, col)
    except IndexError:
        return None


def find_sheet(workbook, name: str, fallback_index: int):
    try:
        return workbook.sheet_by_name(name)
    except xlrd.XLRDError:
        logger.warning(
            f"Sheet {name!r} not found by name, falling back to index {fallback_index}"
        )
        try:
            return workbook.sheet_by_index(fallback_index)
        except IndexError:
            logger.error(f"Fallback sheet index {fallback_index} also not found.")
            return None


def parse_cruise_report(sheet, year: int) -> dict:
    """Extract all fields from the Cruise Report sheet."""
    return {
        "event_date": parse_day_month(clean_text(cell(sheet, "C4")), year),
        "client_name": clean_text(cell(sheet, "C5")),
        "boarding_time": parse_time_decimal(cell(sheet, "C6")),
        "actual_boarding": parse_time_decimal(cell(sheet, "C7")),
        "actual_departure": parse_time_decimal(cell(sheet, "C8")),
        "cruising_time": parse_time_decimal(cell(sheet, "C9")),
        "guest_count": _safe_int(cell(sheet, "C10")),
        "water_taxi": parse_yes_no(cell(sheet, "C11")),
        "extra_time": _extra_time_minutes(cell(sheet, "C12")),
        "weather": clean_text(cell(sheet, "C13")),
        "function_type": clean_text(cell(sheet, "C14")),
        "damages": parse_yes_no(cell(sheet, "C15")),
        "dj_feedback": join_note_cells(sheet, ["B44:F44", "B45:F45", "B46:F46", "B47:F47"]),
        "lost_and_found": join_note_cells(sheet, ["H44:N44", "H45:N45", "H46:N46", "H47:N47"]),
        "feedback": join_note_cells(
            sheet, ["B51:N51", "B52:N52", "B53:N53", "B54:N54", "B55:N55"]
        ),
        "food_explain": join_note_cells(sheet, ["B58:N58", "B59:N59", "B60:N60"]),
        "other": join_note_cells(
            sheet, ["B64:N64", "B65:N65", "B66:N66", "B67:N67", "B68:N68", "B69:N69"]
        ),
    }


def _safe_int(raw) -> int | None:
    if raw is None or raw == "":
        return None
    try:
        return int(float(raw))
    except (ValueError, TypeError):
        return None


def _extra_time_minutes(raw) -> int | None:
    """Example: 3 -> 30 min, 1.5 -> 15 min. So raw * 10 = minutes."""
    val = parse_time_decimal(raw)
    if val is None:
        return None
    return int(round(val * 10))


def parse_bar_summary(sheet) -> list[dict]:
    """Extract per-register bartender rows. Skip any register with a blank name."""
    results = []
    for reg_name, refs in REGISTER_ROWS.items():
        name = clean_text(cell(sheet, refs["name"]))
        if not name:
            continue
        results.append(
            {
                "register_name": reg_name,
                "deck_number": refs["deck"],
                "bartender_name": name.lower(),
                "gross_sales": _safe_float(cell(sheet, refs["gross"])),
                "tip_out": _safe_float(cell(sheet, refs["tip"])),
            }
        )
    return results


def _safe_float(raw) -> float | None:
    if raw is None or raw == "":
        return None
    try:
        return float(raw)
    except (ValueError, TypeError):
        return None
