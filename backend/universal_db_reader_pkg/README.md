# universal-db-reader

A **read-only** Python package for FoxPro/dBase DBF tables (for example POS data such as `EmpDept.DBF` + `EmpDept.CDX`).

It works in three steps:

1. **Registry**: a list of table names and where their `.DBF` files live.
2. **Snapshot**: copies those files (and their `.cdx`/`.fpt`/`.dbt` companions) into a local folder.
3. **Database / Table**: reads and searches **only the copies**. The source files are never opened by the reader.

```
 source (POS)                snapshot_dir                     your code
 C:/posedge/Data/            var/pos_snapshot/
   Employee.DBF   ─refresh─▶   Employee/Employee.DBF   ─read─▶  db.table("Employee").search(...)
   Employee.CDX                Employee/Employee.CDX
```

---

## Install

```sh
python -m pip install .
python -m pip install ".[dbfread,pandas]"     # optional extras
```

From another project's `requirements.txt`:

```txt
-e ./libs/universal_db_reader_pkg[dbfread,pandas]
```

| Extra | Needed for |
|---|---|
| `dbfread` | Optional. Alternate parser. A built-in pure-Python reader is always available. |
| `pandas` | `Table.to_pandas()` only. |

---

## 1. Registry (`registry.py`)

The registry maps a **table name** to a **source `.DBF` path**. It is loaded from a JSON file (TOML is not supported).

### Config file (`tables.json`)

```json
{
  "base_source_dir": "C:/posedge/Data",
  "snapshot_dir": "./var/pos_snapshot",
  "tables": {
    "Employee": "Employee.DBF",
    "SalesPay": "SalesPay.DBF",
    "EmpDept":  "D:/other/place/EmpDept.DBF"
  }
}
```

| Key | Required | Meaning |
|---|---|---|
| `tables` | yes | Table name → path to its `.DBF`. |
| `base_source_dir` | no | Folder used for **relative** table paths. |
| `snapshot_dir` | no | Where copies are stored (see Snapshot). |

A list format is also accepted:

```json
{ "tables": [ {"name": "Employee", "source": "Employee.DBF"} ] }
```

### Rules

- **Table names are case-insensitive.** `employee`, `EMPLOYEE` and `Employee` are the same table. The name is displayed as first written.
- **List only the `.DBF`.** Companion files with the same name (`.cdx`, `.fpt`, `.dbt`) are found automatically.
- **Path resolution** for each table:
  1. Absolute path → used as is.
  2. Relative path → joined to `base_source_dir`.
  3. No `base_source_dir` → joined to the folder containing `tables.json`.
- A relative `base_source_dir` or `snapshot_dir` is resolved from **the folder containing `tables.json`**, not from the current directory.
- Registering the same name again replaces its path.

### Precedence

Every setting uses: **argument / CLI flag > `tables.json` > default**.

### Registering in code

```python
db = UniversalDB()  # no config file
db.register("Employee", r"C:\posedge\Data\Employee.DBF")
```

---

## 2. Snapshot (`snapshot.py`)

`db.refresh()` copies the source files into `snapshot_dir`, one sub-folder per table:

```
<snapshot_dir>/
├── Employee/
│   ├── Employee.DBF
│   └── Employee.CDX
└── SalesPay/
    ├── SalesPay.DBF
    └── SalesPay.CDX
```

### Behaviour

- **Existing copies are replaced** on every refresh.
- **Atomic per file:** each file is copied to a temporary file in the same folder, then swapped in with `os.replace`. A reader never sees a half-written file. If a copy fails, the previous copy stays in place.
- **Missing sources don't stop the batch:** a `RuntimeWarning` is issued, that table's result is `None`, and the other tables are still copied.
- File timestamps are preserved (`shutil.copy2`).

### Where copies go (`snapshot_dir`)

1. `snapshot_dir=` argument / `--snapshot-dir` flag
2. `"snapshot_dir"` in `tables.json`
3. Default: `universal_db_reader/data/` inside the package

> When the package is installed **non-editable** (in `site-packages`), always set `snapshot_dir`. The package folder may be read-only. Add the folder to your project's `.gitignore`.

### Limitations

- Each file is atomic, but a **table as a whole is not**. If the POS writes to a table while it is being copied, the `.DBF` and `.CDX` may not match, or the `.DBF` may hold a partial write. Refresh when the POS is quiet if consistency matters.
- `.CDX` files are copied but **not used** for reading. Searches scan the `.DBF` rows.

---

## 3. Database (`database.py`)

### `UniversalDB`

```python
UniversalDB(config=None, *, base_source_dir=None, snapshot_dir=None, encoding="cp1252")
```

| Method | Returns | Description |
|---|---|---|
| `list_tables()` | `list[str]` | Registered table names. |
| `register(name, source)` | `None` | Add or replace a table. |
| `refresh(table=None)` | `dict[name, Path \| None]` | Copy all tables, or one. Value is the copied `.DBF` path, or `None` if the source is missing. |
| `table(name)` | `Table` | Access a table's snapshot. |

`encoding` is the text encoding of the DBF character fields (`cp1252` for most Western POS systems).

### `Table`

All methods read the **snapshot**. If no snapshot exists, they raise `FileNotFoundError` asking you to call `refresh()` first.

| Method | SQL equivalent | Description |
|---|---|---|
| `fields()` | – | Field names, in order. Reads only the header (fast). |
| `schema()` | – | `[{name, type, length, decimal}, ...]` |
| `count()` | `SELECT COUNT(*)` | Record count from the header. **Includes deleted records.** |
| `head(n=5)` | `SELECT * LIMIT n` | First `n` rows. |
| `read(limit=None, include_deleted=False)` | `SELECT *` | All rows (or the first `limit`). |
| `iter_rows()` | – | Lazy generator, one row at a time (low memory). |
| `search(field, value, ..., limit=None)` | `SELECT * WHERE ... LIMIT n` | See below. |
| `to_pandas(limit=None)` | – | DataFrame (needs pandas). |
| `export_csv(path)` | – | Writes the table to CSV (UTF-8 with BOM, opens cleanly in Excel). |

Rows are `dict`s: `{"FIELD": value, ...}`. Values are converted to Python types: `str`, `int`, `float`, `Decimal` (currency), `date`, `datetime`, `bool`, and memo text or `bytes`.

Deleted records are skipped by default. Use `read(include_deleted=True)` to include them; each row then gets a `__deleted__` flag.

### Searching

```python
t = db.table("Employee")

t.search("LASTNAME", "smith")  # exact, case-insensitive
t.search("LASTNAME", "smi", contains=True)  # substring
t.search(value="smith", any_field=True)  # substring in any field
t.search("EMPNUM", "105")  # "105" matches numeric 105
t.search("LASTNAME", "Smith", case_sensitive=True)
t.search("LASTNAME", "smi", contains=True, limit=3)  # first 3 matches only
```

| Option | Default | Meaning |
|---|---|---|
| `field` | – | Field to compare. Unknown fields raise `KeyError` listing the valid ones. |
| `value` | required | Value to look for. |
| `contains` | `False` | Substring match instead of exact. |
| `any_field` | `False` | Match the value as a substring in any field (no `field` needed). |
| `case_sensitive` | `False` | Case-sensitive comparison. |
| `limit` | `None` | Stop after `n` matches. Reading stops there too, so it's faster on large tables. |

---

## Full example

```python
from universal_db_reader import UniversalDB

db = UniversalDB("tables.json")
db.refresh()

emp = db.table("Employee")
print(emp.fields())  # ['EMPNUM', 'FIRSTNAME', 'LASTNAME', ...]
print(emp.head(3))  # SELECT * FROM Employee LIMIT 3
print(emp.search("LASTNAME", "smi", contains=True, limit=3))
```

---

## CLI

Global options (`--config`, `--base-source-dir`, `--snapshot-dir`, `--encoding`) go **before** the command.

```sh
python -m universal_db_reader --config tables.json list
python -m universal_db_reader --config tables.json refresh
python -m universal_db_reader --config tables.json refresh --table Employee
python -m universal_db_reader --config tables.json fields Employee
python -m universal_db_reader --config tables.json fields Employee --schema
python -m universal_db_reader --config tables.json head Employee -n 3
python -m universal_db_reader --config tables.json search Employee --field LASTNAME --value smi --contains -n 3
python -m universal_db_reader --config tables.json search Employee --value smith --any-field
```

Output is JSON. Dates are ISO strings and binary values are shown as hex. Exit code is `0` on success and `2` on error.