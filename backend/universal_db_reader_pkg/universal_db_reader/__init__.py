"""Universal read-only DBF table reader with registered atomic snapshots."""

from .database import UniversalDB
from .reader import load_table, search_records

__all__ = ["UniversalDB", "load_table", "search_records"]
__version__ = "0.1.0"
