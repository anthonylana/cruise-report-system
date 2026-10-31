"""Command-line interface for universal_db_reader."""

from __future__ import annotations

import argparse
import json
import sys

from . import UniversalDB
from .reader import _json_default


def _dump(obj) -> None:
    print(json.dumps(obj, ensure_ascii=False, indent=2, default=_json_default))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m universal_db_reader",
        description="Read-only snapshot DBF reader",
    )
    parser.add_argument("--config", help="JSON registry config path")
    parser.add_argument(
        "--base-source-dir", help="Base directory for relative source paths"
    )
    parser.add_argument(
        "--snapshot-dir",
        help="Snapshot output directory (default: config or package data/)",
    )
    parser.add_argument(
        "--encoding", default="cp1252", help="Text encoding of the DBF files"
    )
    subs = parser.add_subparsers(dest="command", required=True)

    subs.add_parser("list", help="List registered tables")

    refresh = subs.add_parser("refresh", help="Refresh snapshots for all tables or one")
    refresh.add_argument("--table")

    fields = subs.add_parser("fields", help="List field names of a table")
    fields.add_argument("table")
    fields.add_argument(
        "--schema", action="store_true", help="Show type/length/decimal too"
    )

    head = subs.add_parser("head", help="First N rows (SELECT * ... LIMIT N)")
    head.add_argument("table")
    head.add_argument("-n", "--limit", type=int, default=5)

    search = subs.add_parser("search", help="Search a table snapshot")
    search.add_argument("table")
    search.add_argument("--field")
    search.add_argument("--value", required=True)
    search.add_argument("--contains", action="store_true")
    search.add_argument("--any-field", action="store_true")
    search.add_argument("--case-sensitive", action="store_true")
    search.add_argument("-n", "--limit", type=int, help="Max rows to return")

    args = parser.parse_args(argv)
    try:
        db = UniversalDB(
            args.config,
            base_source_dir=args.base_source_dir,
            snapshot_dir=args.snapshot_dir,
            encoding=args.encoding,
        )
        if args.command == "list":
            _dump(db.list_tables())
        elif args.command == "refresh":
            result = db.refresh(args.table)
            _dump({k: str(v) if v else None for k, v in result.items()})
        elif args.command == "fields":
            t = db.table(args.table)
            _dump(t.schema() if args.schema else t.fields())
        elif args.command == "head":
            _dump(db.table(args.table).head(args.limit))
        else:
            _dump(
                db.table(args.table).search(
                    args.field,
                    args.value,
                    contains=args.contains,
                    any_field=args.any_field,
                    case_sensitive=args.case_sensitive,
                    limit=args.limit,
                )
            )
        return 0
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise
