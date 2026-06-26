from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend import crud, schemas
from backend.database import get_db


router = APIRouter(tags=["sessions"])


@router.get("/sessions", response_model=list[schemas.SessionRead])
def list_sessions(race_id: int = Query(..., ge=1), db: Session = Depends(get_db)):
    return crud.get_sessions_by_race(db, race_id)


@router.get("/session-detail", response_model=schemas.SessionDetailRead)
def session_detail(session_id: int = Query(..., ge=1), db: Session = Depends(get_db)):
    detail = crud.get_session_detail(db, session_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return detail


@router.post("/session-metadata-warmup")
def session_metadata_warmup(session_id: int = Query(..., ge=1), db: Session = Depends(get_db)):
    scheduled = crud.warm_session_metadata(db, session_id)
    if scheduled is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "scheduled" if scheduled else "already-warming"}


@router.post("/session-telemetry-warmup")
def session_telemetry_warmup(session_id: int = Query(..., ge=1), db: Session = Depends(get_db)):
    scheduled = crud.warm_session_telemetry(db, session_id)
    if scheduled is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "scheduled" if scheduled else "already-warming"}
