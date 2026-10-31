"""Atomic per-file snapshots for registered DBF tables and companions."""

from __future__ import annotations

import os
import shutil
import tempfile
import warnings
from pathlib import Path

_COMPANIONS = {".cdx", ".fpt", ".dbt"}


def _companions(source: Path) -> list[Path]:
    found = []
    try:
        for candidate in source.parent.iterdir():
            if (
                candidate.is_file()
                and candidate.stem.casefold() == source.stem.casefold()
                and candidate.suffix.casefold() in _COMPANIONS
            ):
                found.append(candidate)
    except OSError:
        pass
    return sorted(found, key=lambda p: p.name.casefold())


def _atomic_copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(
        prefix=f".{destination.name}.", suffix=".tmp", dir=destination.parent
    )
    os.close(fd)
    try:
        shutil.copy2(source, temp_name)
        os.replace(temp_name, destination)
    finally:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass


def refresh_table(entry: dict, root: Path) -> Path | None:
    source: Path = entry["source"]
    target_dir = root / entry["name"]
    if not source.is_file():
        warnings.warn(
            f"Missing DBF source for table {entry['name']!r}: {source}", RuntimeWarning
        )
        return None
    _atomic_copy(source, target_dir / source.name)
    for companion in _companions(source):
        _atomic_copy(companion, target_dir / companion.name)
    return target_dir / source.name
