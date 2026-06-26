from pathlib import Path
import threading
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func

from backend import models
from backend.database import Base, SessionLocal, engine, ensure_schema_compatibility
from backend.backfill_sessions import backfill_all_sessions
from backend.fastf1_data import schedule_session_metadata_warmup, schedule_session_telemetry_warmup
from backend.routers import drivers, laps, races, seasons, sessions, telemetry


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


app = FastAPI(
    title="Historical Racing Telemetry Service",
    description="Educational web service for exploring historical racing telemetry data.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=512)

Base.metadata.create_all(bind=engine)
ensure_schema_compatibility()

app.include_router(seasons.router)
app.include_router(races.router)
app.include_router(sessions.router)
app.include_router(drivers.router)
app.include_router(laps.router)
app.include_router(telemetry.router)

app.mount("/assets", StaticFiles(directory=FRONTEND_DIR), name="assets")


@app.on_event("startup")
def warm_latest_season_metadata():
    db = SessionLocal()
    try:
        latest_year = db.query(func.max(models.Season.year)).scalar()
        if latest_year is None:
            return

        session_ids = (
            db.query(models.Session.id)
            .join(models.GrandPrix, models.GrandPrix.id == models.Session.grand_prix_id)
            .join(models.Season, models.Season.id == models.GrandPrix.season_id)
            .filter(models.Season.year == latest_year)
            .filter(models.Session.laps_hydrated.is_(False))
            .order_by(models.GrandPrix.date.desc(), models.Session.session_index.asc())
            .all()
        )
    finally:
        db.close()

    for session_id, in session_ids:
        schedule_session_metadata_warmup(session_id)


@app.on_event("startup")
def backfill_archive_in_background():
    if os.getenv("ENABLE_ARCHIVE_BACKFILL_ON_STARTUP", "").lower() not in {"1", "true", "yes"}:
        return

    threading.Thread(
        target=backfill_all_sessions,
        daemon=True,
        name="archive-session-backfill",
    ).start()


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def serve_dashboard():
    return FileResponse(FRONTEND_DIR / "index.html")
