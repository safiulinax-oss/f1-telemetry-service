from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from backend import crud, schemas
from backend.database import get_db


router = APIRouter(tags=["laps"])


@router.get("/laps", response_model=list[schemas.LapRead])
def list_laps(
    response: Response,
    session_id: int = Query(..., ge=1),
    driver_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
):
    laps = crud.get_laps(db, session_id, driver_id)
    if laps:
        response.headers["Cache-Control"] = "public, max-age=120"
    return laps
