from fastapi import FastAPI

from app.api.routes import imports


app = FastAPI(title="Cruise Report Manager API", version="0.1.0")
app.include_router(imports.router, prefix="/api")


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Cruise Report System API is running"}


@app.get("/api/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
