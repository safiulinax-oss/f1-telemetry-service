from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend import crud, schemas
from backend.database import get_db


router = APIRouter(tags=["seasons"])


@router.get("/seasons", response_model=list[schemas.SeasonRead])
def list_seasons(db: Session = Depends(get_db)):
    return crud.get_seasons(db)
