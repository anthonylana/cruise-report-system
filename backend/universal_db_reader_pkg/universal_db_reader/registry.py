"""Case-insensitive table registry backed by JSON configuration."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class TableRegistry:
    def __init__(
        self,
        config: str | Path | None = None,
        *,
        base_source_dir: str | Path | None = None,
    ):
        self.config_path = Path(config).expanduser().resolve() if config else None
        self.base_source_dir = (
            Path(base_source_dir).expanduser().resolve() if base_source_dir else None
        )
        self.snapshot_dir: Path | None = None
        self._tables: dict[str, dict[str, Any]] = {}
        if self.config_path:
            self._load(self.config_path)

    def _load(self, path: Path) -> None:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            base = payload.get("base_source_dir")
            if base and self.base_source_dir is None:
                bp = Path(base).expanduser()
                self.base_source_dir = (
                    (path.parent / bp).resolve()
                    if not bp.is_absolute()
                    else bp.resolve()
                )
            snap = payload.get("snapshot_dir")
            if snap:
                sp = Path(snap).expanduser()
                self.snapshot_dir = (
                    (path.parent / sp).resolve()
                    if not sp.is_absolute()
                    else sp.resolve()
                )
            raw = payload.get("tables", {})
        else:
            raw = payload
        if isinstance(raw, dict):
            items = raw.items()
        elif isinstance(raw, list):
            items = (
                (item["name"], item.get("source", item.get("path"))) for item in raw
            )
        else:
            raise TypeError("JSON config must contain a tables object or array")
        for name, source in items:
            self.register(name, source)

    def register(self, name: str, source: str | Path) -> None:
        if not name or not str(name).strip():
            raise ValueError("Table name cannot be empty")
        if source is None:
            raise ValueError(f"Missing source path for table {name!r}")
        path = Path(source).expanduser()
        if not path.is_absolute():
            path = (
                self.base_source_dir
                or (self.config_path.parent if self.config_path else Path.cwd())
            ) / path
        key = str(name).casefold()
        prior = self._tables.get(key)
        self._tables[key] = {
            "name": prior["name"] if prior else str(name),
            "source": path.resolve(),
        }

    def get(self, name: str) -> dict[str, Any]:
        try:
            return self._tables[name.casefold()]
        except KeyError:
            raise KeyError(
                f"Unknown table {name!r}; available: {', '.join(self.list_tables())}"
            ) from None

    def list_tables(self) -> list[str]:
        return [v["name"] for v in self._tables.values()]

    def entries(self) -> list[dict[str, Any]]:
        return list(self._tables.values())
