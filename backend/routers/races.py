from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from backend import crud, schemas
from backend.database import get_db


router = APIRouter(tags=["races"])


@router.get("/races", response_model=list[schemas.GrandPrixRead])
def list_races(response: Response, season_id: int = Query(..., ge=1), db: Session = Depends(get_db)):
    races = crud.get_races_by_season(db, season_id)
    response.headers["Cache-Control"] = "public, max-age=600"
    return races
