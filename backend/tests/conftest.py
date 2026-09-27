import os

# Dummy settings so app.config.Settings() can be created without a .env file.
# Must run before anything imports `app`. Tests use SQLite, so these are never used to connect.
os.environ.setdefault("POSTGRES_USER", "test")
os.environ.setdefault("POSTGRES_PASSWORD", "test")
os.environ.setdefault("POSTGRES_DB", "test")