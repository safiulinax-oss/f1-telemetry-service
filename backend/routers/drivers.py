from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend import crud, schemas
from backend.database import get_db


router = APIRouter(tags=["drivers"])


@router.get("/drivers", response_model=list[schemas.DriverRead])
def list_drivers(session_id: int = Query(..., ge=1), db: Session = Depends(get_db)):
    return crud.get_drivers_by_session(db, session_id)
