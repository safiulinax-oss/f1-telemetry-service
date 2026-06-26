from sqlalchemy.orm import joinedload

from backend.database import SessionLocal, ensure_schema_compatibility
from backend.fastf1_data import (
    claim_session_metadata_warmup,
    hydrate_session_metadata,
    release_session_metadata_warmup,
)
from backend.models import GrandPrix, Session


def backfill_all_sessions() -> None:
    ensure_schema_compatibility()
    db = SessionLocal()
    try:
        sessions = (
            db.query(Session)
            .options(joinedload(Session.grand_prix).joinedload(GrandPrix.season))
            .filter(Session.laps_hydrated.is_(False))
            .order_by(Session.id.asc())
            .all()
        )
        total = len(sessions)
        print(f"Backfilling {total} sessions...")
        for index, session_model in enumerate(sessions, start=1):
            if not claim_session_metadata_warmup(session_model.id):
                continue
            try:
                hydrate_session_metadata(db, session_model)
                db.expire_all()
                print(
                    f"[{index}/{total}] "
                    f"{session_model.grand_prix.season.year} "
                    f"{session_model.grand_prix.name} "
                    f"{session_model.session_type}"
                )
            finally:
                release_session_metadata_warmup(session_model.id)
    finally:
        db.close()


if __name__ == "__main__":
    backfill_all_sessions()
