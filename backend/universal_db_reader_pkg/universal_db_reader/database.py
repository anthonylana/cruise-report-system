"""High-level API: registry, snapshots, and table access."""

from __future__ import annotations

import csv
import itertools
from pathlib import Path
from typing import Any

from .reader import _json_default, _metadata, iter_table, search_records
from .registry import TableRegistry
from .snapshot import refresh_table

DEFAULT_SNAPSHOT_DIR = Path(__file__).parent / "data"


class UniversalDB:
    def __init__(
        self,
        config: str | Path | None = None,
        *,
        base_source_dir: str | Path | None = None,
        snapshot_dir: str | Path | None = None,
        encoding: str = "cp1252",
    ):
        self.registry = TableRegistry(config, base_source_dir=base_source_dir)
        # argument > config file > package default
        if snapshot_dir is not None:
            self.snapshot_dir = Path(snapshot_dir).expanduser().resolve()
        elif self.registry.snapshot_dir is not None:
            self.snapshot_dir = self.registry.snapshot_dir
        else:
            self.snapshot_dir = DEFAULT_SNAPSHOT_DIR
        self.encoding = encoding

    def register(self, name: str, source: str | Path) -> None:
        self.registry.register(name, source)

    def list_tables(self) -> list[str]:
        return self.registry.list_tables()

    def refresh(self, table: str | None = None) -> dict[str, Path | None]:
        """Refresh all registered tables (default) or just one named table."""
        entries = [self.registry.get(table)] if table else self.registry.entries()
        return {e["name"]: refresh_table(e, self.snapshot_dir) for e in entries}

    def table(self, name: str) -> Table:
        entry = self.registry.get(name)
        return Table(entry["name"], self.snapshot_dir / entry["name"], self.encoding)


class Table:
    def __init__(self, name: str, snapshot_directory: Path, encoding: str):
        self.name, self.snapshot_directory, self.encoding = (
            name,
            snapshot_directory,
            encoding,
        )

    def _path(self) -> Path:
        if self.snapshot_directory.exists():
            files = sorted(
                (
                    p
                    for p in self.snapshot_directory.iterdir()
                    if p.is_file() and p.suffix.casefold() == ".dbf"
                ),
                key=lambda p: p.name.casefold(),
            )
            if files:
                return files[0]
        raise FileNotFoundError(
            f"No snapshot exists for table {self.name!r}; call db.refresh() first"
        )

    # ---- structure (reads only the header, no rows) ----
    def fields(self) -> list[str]:
        """Field (column) names, in table order."""
        return [f["name"] for f in _metadata(self._path())["fields"]]

    def schema(self) -> list[dict[str, Any]]:
        """Full field info: name, type, length, decimal."""
        return _metadata(self._path())["fields"]

    def count(self) -> int:
        """Record count from the header (includes deleted records)."""
        return _metadata(self._path())["record_count"]

    # ---- rows ----
    def iter_rows(
        self, *, include_deleted: bool = False, ignore_missing_memofile: bool = False
    ):
        return iter_table(
            self._path(),
            encoding=self.encoding,
            include_deleted=include_deleted,
            ignore_missing_memofile=ignore_missing_memofile,
        )

    def read(
        self,
        *,
        include_deleted: bool = False,
        ignore_missing_memofile: bool = False,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        if limit is not None and limit < 0:
            raise ValueError("limit must be >= 0")
        rows = self.iter_rows(
            include_deleted=include_deleted,
            ignore_missing_memofile=ignore_missing_memofile,
        )
        return list(itertools.islice(rows, limit)) if limit is not None else list(rows)

    def head(self, n: int = 5) -> list[dict[str, Any]]:
        """SELECT * FROM table LIMIT n"""
        return self.read(limit=n)

    def search(
        self,
        field: str | None = None,
        value: Any = None,
        *,
        contains: bool = False,
        any_field: bool = False,
        case_sensitive: bool = False,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        """SELECT * FROM table WHERE ... [LIMIT n]. Stops reading once limit is reached."""
        return search_records(
            self.iter_rows(),
            field,
            value,
            contains=contains,
            any_field=any_field,
            case_sensitive=case_sensitive,
            limit=limit,
        )

    def to_pandas(self, limit: int | None = None):
        try:
            import pandas as pd
        except ImportError as exc:
            raise ImportError(
                "Install universal-db-reader[pandas] to use to_pandas()"
            ) from exc
        return pd.DataFrame(self.read(limit=limit), columns=self.fields())

    def export_csv(self, path: str | Path, *, encoding: str = "utf-8-sig") -> Path:
        fields = self.fields()
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", newline="", encoding=encoding) as out:
            writer = csv.DictWriter(out, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            for row in self.iter_rows():  # streams, low memory
                writer.writerow({k: _json_default(v) for k, v in row.items()})
        return target
