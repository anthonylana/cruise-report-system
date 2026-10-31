#!/usr/bin/env python3
"""DBF decoding and search primitives, adapted from the earlier standalone reader."""

from __future__ import annotations

import datetime as _dt
import decimal
import struct
from collections.abc import Iterable, Iterator
from pathlib import Path
from typing import Any


def _metadata(path: Path) -> dict[str, Any]:
    with path.open("rb") as f:
        header = f.read(32)
        if len(header) != 32:
            raise ValueError("File is too short to contain a DBF header")
        version = header[0]
        count = int.from_bytes(header[4:8], "little")
        header_len = int.from_bytes(header[8:10], "little")
        record_len = int.from_bytes(header[10:12], "little")
        if header_len < 33 or record_len < 1:
            raise ValueError("Invalid DBF header or record length")
        f.seek(32)
        descriptors = []
        while f.tell() < header_len:
            d = f.read(32)
            if not d or d[0] == 0x0D:
                break
            if len(d) < 32:
                raise ValueError("Truncated DBF field descriptor")
            name = d[:11].split(b"\0", 1)[0].decode("ascii", "replace")
            descriptors.append(
                {"name": name, "type": chr(d[11]), "length": d[16], "decimal": d[17]}
            )
        return {
            "version": version,
            "record_count": count,
            "header_length": header_len,
            "record_length": record_len,
            "language_driver": header[29],
            "fields": descriptors,
        }


def _locate_memo(path: Path) -> Path | None:
    for suffix in (".fpt", ".FPT", ".dbt", ".DBT"):
        candidate = path.with_suffix(suffix)
        if candidate.exists():
            return candidate
    try:
        for candidate in path.parent.iterdir():
            if (
                candidate.stem.casefold() == path.stem.casefold()
                and candidate.suffix.casefold() in (".fpt", ".dbt")
            ):
                return candidate
    except OSError:
        pass
    return None


def _fpt_read(memo_path: Path | None, pointer: int, encoding: str) -> Any:
    if not memo_path or pointer <= 0:
        return None
    with memo_path.open("rb") as f:
        head = f.read(8)
        if len(head) < 8:
            return None
        block_size = int.from_bytes(head[6:8], "big")
        if not block_size:
            block_size = 512
        f.seek(pointer * block_size)
        block = f.read(8)
        if len(block) < 8:
            return None
        kind, length = struct.unpack(">II", block)
        payload = f.read(length)
        if kind == 1:
            return payload.decode(encoding, errors="replace").rstrip("\x00")
        return payload


def _decode_fallback(
    raw: bytes, desc: dict[str, Any], encoding: str, memo_path: Path | None
) -> Any:
    typ, decimals = desc["type"].upper(), desc["decimal"]
    text = raw.decode(encoding, errors="replace")
    if typ in ("C", "V"):
        return text.rstrip(" \x00")
    if typ in ("N", "F"):
        value = text.strip()
        if not value or value in ("*",):
            return None
        try:
            return float(value) if decimals else int(value)
        except ValueError:
            try:
                return float(value)
            except ValueError:
                return value
    if typ == "L":
        c = text.strip().upper()
        return True if c in ("Y", "T") else False if c in ("N", "F") else None
    if typ == "D":
        value = text.strip()
        if not value or value == "00000000":
            return None
        try:
            return _dt.date(int(value[:4]), int(value[4:6]), int(value[6:8]))
        except ValueError:
            return value
    if typ in ("I", "+") and len(raw) >= 4:
        return struct.unpack("<i", raw[:4])[0]
    if typ == "B" and len(raw) == 8:
        return struct.unpack("<d", raw)[0]
    if typ == "Y" and len(raw) == 8:
        return decimal.Decimal(struct.unpack("<q", raw)[0]) / decimal.Decimal(10000)
    if typ == "T" and len(raw) >= 8:
        julian, millis = struct.unpack("<ii", raw[:8])
        if julian <= 0:
            return None
        try:
            day = _dt.date.fromordinal(julian - 1721425)
            return _dt.datetime.combine(day, _dt.time()) + _dt.timedelta(
                milliseconds=millis
            )
        except (ValueError, OverflowError):
            return (julian, millis)
    if typ in ("M", "G", "P", "W"):
        pointer = 0
        # VFP memo pointers are four-byte little-endian block numbers; older
        # dBase memo fields may contain a right-aligned decimal block number.
        if len(raw) == 4:
            pointer = int.from_bytes(raw, "little")
        else:
            try:
                pointer = int(text.strip() or "0")
            except ValueError:
                return None
        return _fpt_read(memo_path, pointer, encoding)
    return text.rstrip(" \x00")


def _fallback_iter(
    path: Path, encoding: str, ignore_missing_memofile: bool, include_deleted: bool
) -> Iterator[dict[str, Any]]:
    meta = _metadata(path)
    memo_path = _locate_memo(path)
    has_memo = any(f["type"].upper() in ("M", "G", "P", "W") for f in meta["fields"])
    if has_memo and memo_path is None and not ignore_missing_memofile:
        raise FileNotFoundError(f"Memo file (.FPT/.DBT) not found next to {path}")
    with path.open("rb") as f:
        f.seek(meta["header_length"])
        for _ in range(meta["record_count"]):
            record = f.read(meta["record_length"])
            if len(record) < meta["record_length"]:
                raise ValueError("DBF ended before the header-declared record count")
            status = record[0]
            if status not in (0x20, 0x2A):
                continue
            deleted = status == 0x2A
            if deleted and not include_deleted:
                continue
            pos, row = 1, {}
            for field in meta["fields"]:
                raw = record[pos : pos + field["length"]]
                if len(raw) != field["length"]:
                    raise ValueError("Record does not match DBF field widths")
                row[field["name"]] = _decode_fallback(raw, field, encoding, memo_path)
                pos += field["length"]
            if include_deleted:
                row["__deleted__"] = deleted
            yield row


def _dbfread_iter(
    path: Path, encoding: str, ignore_missing_memofile: bool, include_deleted: bool
) -> Iterator[dict[str, Any]]:
    from dbfread import DBF
    from dbfread.field_parser import FieldParser

    # Parsing the record stream directly keeps the deletion marker, unlike
    # DBF's ordinary iterator, which silently skips deleted records.
    table = DBF(
        str(path),
        encoding=encoding,
        ignore_missing_memofile=ignore_missing_memofile,
        char_decode_errors="replace",
    )
    with path.open("rb") as f, table._open_memofile() as memo:
        parser = FieldParser(table, memo)
        f.seek(table.header.headerlen)
        for _ in range(table.header.numrecords):
            record = f.read(table.header.recordlen)
            if len(record) < table.header.recordlen:
                raise ValueError("DBF ended before the header-declared record count")
            status = record[0:1]
            if status not in (b" ", b"*"):
                continue
            deleted = status == b"*"
            if deleted and not include_deleted:
                continue
            pos, row = 1, {}
            for field in table.fields:
                row[field.name] = parser.parse(field, record[pos : pos + field.length])
                pos += field.length
            if include_deleted:
                row["__deleted__"] = deleted
            yield row


def iter_table(
    path: str | Path,
    encoding: str = "cp1252",
    ignore_missing_memofile: bool = False,
    include_deleted: bool = False,
) -> Iterator[dict[str, Any]]:
    """Yield rows one at a time (lazy). Stopping early stops reading the file."""
    path = Path(path)
    meta = _metadata(path)
    has_memo = any(f["type"].upper() in ("M", "G", "P", "W") for f in meta["fields"])
    if has_memo and _locate_memo(path) is None and not ignore_missing_memofile:
        raise FileNotFoundError(f"Memo file (.FPT/.DBT) not found next to {path}")
    # FoxPro's B type is an 8-byte double here; dbfread may treat it as memo data.
    use_fallback = any(f["type"].upper() == "B" for f in meta["fields"])
    if not use_fallback:
        try:
            import dbfread  # noqa: F401
        except ImportError:
            use_fallback = True
    impl = _fallback_iter if use_fallback else _dbfread_iter
    return impl(path, encoding, ignore_missing_memofile, include_deleted)


def load_table(
    path: str | Path,
    encoding: str = "cp1252",
    ignore_missing_memofile: bool = False,
    include_deleted: bool = False,
) -> list[dict[str, Any]]:
    """Load a whole DBF as a list of dicts. Deleted rows are excluded by default."""
    return list(iter_table(path, encoding, ignore_missing_memofile, include_deleted))


def search_records(
    records: Iterable[dict[str, Any]],
    field: str | None = None,
    value: Any = None,
    *,
    contains: bool = False,
    any_field: bool = False,
    case_sensitive: bool = False,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Filter records by exact value, substring, or any-field substring.

    limit: stop after this many matches (like SQL LIMIT). None means no limit.
    """
    if value is None:
        raise ValueError("A search value is required")
    if not any_field and not field:
        raise ValueError("Specify a field or set any_field=True")
    if limit is not None and limit < 0:
        raise ValueError("limit must be >= 0")
    if limit == 0:
        return []
    records = iter(records)
    if field:
        first = next(records, None)
        if first is None:
            return []
        if field not in first:
            raise KeyError(f"Unknown field {field!r}; available: {', '.join(first)}")
        import itertools

        records = itertools.chain((first,), records)
    needle = str(value) if case_sensitive else str(value).casefold()

    def matches(item: Any) -> bool:
        if contains:
            hay = str(item) if case_sensitive else str(item).casefold()
            return needle in hay
        if isinstance(value, str) and isinstance(item, str):
            return (
                (item == value)
                if case_sensitive
                else item.casefold() == value.casefold()
            )
        if isinstance(value, str) and isinstance(item, (int, float, decimal.Decimal)):
            try:
                return decimal.Decimal(str(item)) == decimal.Decimal(value.strip())
            except decimal.InvalidOperation:
                return str(item) == value
        return item == value

    out = []
    for row in records:
        candidates = row.values() if any_field else (row.get(field),)
        if any(matches(item) for item in candidates if item is not None):
            out.append(row)
            if limit is not None and len(out) >= limit:
                break
    return out


def _json_default(value: Any) -> Any:
    if isinstance(value, (bytes, bytearray)):
        return {"bytes_hex": bytes(value).hex()}
    if isinstance(value, (_dt.date, _dt.datetime, decimal.Decimal)):
        return value.isoformat() if hasattr(value, "isoformat") else str(value)
    return str(value)
