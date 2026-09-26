from app.config import settings

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import imports


app = FastAPI(title="Cruise Report Manager API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # explicit list, never "*"
    allow_credentials=False,              # no cookies/auth in this app
    allow_methods=["GET", "POST"],        # only what we actually use
    allow_headers=["*"],
)

app.include_router(imports.router, prefix="/api")


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Cruise Report System API is running"}


@app.get("/api/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
