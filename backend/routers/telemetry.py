from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from backend import crud, schemas
from backend.database import get_db


router = APIRouter(tags=["telemetry"])


@router.get("/telemetry", response_model=list[schemas.TelemetryPointRead])
def list_telemetry(lap_id: int = Query(..., ge=1), db: Session = Depends(get_db)):
    return crud.get_telemetry_points(db, lap_id)


@router.get("/lap-detail", response_model=schemas.LapDetailRead)
def lap_detail(response: Response, lap_id: int = Query(..., ge=1), db: Session = Depends(get_db)):
    detail = crud.get_lap_detail(db, lap_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Lap not found")
    response.headers["Cache-Control"] = "no-store"
    return detail


@router.get("/lap-summary", response_model=schemas.LapSummary)
def lap_summary(response: Response, lap_id: int = Query(..., ge=1), db: Session = Depends(get_db)):
    summary = crud.get_lap_summary(db, lap_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Lap not found")
    response.headers["Cache-Control"] = "public, max-age=300"
    return summary
