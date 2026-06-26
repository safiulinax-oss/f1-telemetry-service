from __future__ import annotations

import argparse
from datetime import date

from sqlalchemy.orm import joinedload

from backend.database import Base, SessionLocal, engine, ensure_schema_compatibility
from backend.fastf1_data import (
    build_real_season_dataset,
    circuit_name_for_event,
    get_event_schedule,
    hydrate_session_metadata,
    iter_event_sessions,
    sanitize_text,
)
from backend.models import GrandPrix, Season, Session
from backend.seed_data import detect_supported_season_years


def _completed_schedule(year: int):
    schedule = get_event_schedule(year)
    today = date.today()
    if year >= today.year:
        schedule = schedule[
            schedule["EventDate"].apply(
                lambda value: (
                    value.date() if hasattr(value, "date") else date.fromisoformat(str(value))
                ) <= today
            )
        ]
    return schedule


def sync_season_dataset(db, year: int) -> dict[str, int]:
    season = db.query(Season).filter(Season.year == year).first()
    if season is None:
        race_count, session_count, lap_count = build_real_season_dataset(db, year=year)
        return {
            "year": year,
            "new_seasons": 1,
            "new_races": race_count,
            "new_sessions": session_count,
            "updated_races": 0,
            "updated_sessions": 0,
            "lap_count": lap_count,
        }

    schedule = _completed_schedule(year)
    existing_grands_prix = {
        grand_prix.round_number: grand_prix
        for grand_prix in (
            db.query(GrandPrix)
            .options(joinedload(GrandPrix.sessions))
            .filter(GrandPrix.season_id == season.id)
            .all()
        )
    }

    new_races = 0
    new_sessions = 0
    updated_races = 0
    updated_sessions = 0

    for event_row in schedule.itertuples(index=False):
        round_number = int(event_row.RoundNumber)
        event_name = sanitize_text(event_row.EventName)
        event_country = sanitize_text(event_row.Country)
        track_name = sanitize_text(circuit_name_for_event(str(event_row.EventName), str(event_row.Location)))
        event_date = (
            event_row.EventDate.date()
            if hasattr(event_row.EventDate, "date")
            else date.fromisoformat(str(event_row.EventDate))
        )

        grand_prix = existing_grands_prix.get(round_number)
        if grand_prix is None:
            grand_prix = GrandPrix(
                season=season,
                round_number=round_number,
                name=event_name,
                country=event_country,
                track_name=track_name,
                date=event_date,
            )
            db.add(grand_prix)
            db.flush()
            existing_grands_prix[round_number] = grand_prix
            new_races += 1
        else:
            race_changed = False
            if grand_prix.name != event_name:
                grand_prix.name = event_name
                race_changed = True
            if grand_prix.country != event_country:
                grand_prix.country = event_country
                race_changed = True
            if grand_prix.track_name != track_name:
                grand_prix.track_name = track_name
                race_changed = True
            if grand_prix.date != event_date:
                grand_prix.date = event_date
                race_changed = True
            if race_changed:
                updated_races += 1

        existing_sessions = {session.session_index: session for session in grand_prix.sessions}
        for session_index, session_name in iter_event_sessions(event_row._asdict()):
            session_model = existing_sessions.get(session_index)
            if session_model is None:
                session_model = Session(
                    grand_prix=grand_prix,
                    session_index=session_index,
                    session_type=str(session_name),
                    air_temp=0.0,
                    track_temp=0.0,
                    wind_speed=0.0,
                    laps_hydrated=False,
                )
                db.add(session_model)
                existing_sessions[session_index] = session_model
                new_sessions += 1
                continue

            if session_model.session_type != str(session_name):
                session_model.session_type = str(session_name)
                updated_sessions += 1

    db.commit()
    return {
        "year": year,
        "new_seasons": 0,
        "new_races": new_races,
        "new_sessions": new_sessions,
        "updated_races": updated_races,
        "updated_sessions": updated_sessions,
        "lap_count": 0,
    }


def hydrate_pending_sessions(db, years: list[int]) -> int:
    pending_sessions = (
        db.query(Session)
        .options(joinedload(Session.grand_prix).joinedload(GrandPrix.season))
        .join(GrandPrix, GrandPrix.id == Session.grand_prix_id)
        .join(Season, Season.id == GrandPrix.season_id)
        .filter(Season.year.in_(years))
        .filter(Session.laps_hydrated.is_(False))
        .order_by(Season.year.asc(), GrandPrix.round_number.asc(), Session.session_index.asc())
        .all()
    )

    hydrated = 0
    total = len(pending_sessions)
    for index, session_model in enumerate(pending_sessions, start=1):
        hydrate_session_metadata(db, session_model)
        hydrated += 1
        print(
            f"[{index}/{total}] Hydrated {session_model.grand_prix.season.year} "
            f"{session_model.grand_prix.name} {session_model.session_type}"
        )

    return hydrated


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Incrementally sync completed race weekends from FastF1 into PostgreSQL."
    )
    parser.add_argument(
        "--years",
        nargs="+",
        type=int,
        help="Specific season years to sync. Defaults to all supported years up to today.",
    )
    parser.add_argument(
        "--skip-hydration",
        action="store_true",
        help="Only sync seasons, grands prix and session records without hydrating drivers and laps.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    target_years = args.years or detect_supported_season_years()

    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()

    db = SessionLocal()
    try:
        summaries = []
        for year in target_years:
            summary = sync_season_dataset(db, year)
            summaries.append(summary)
            print(
                f"{year}: +seasons={summary['new_seasons']}, "
                f"+races={summary['new_races']}, +sessions={summary['new_sessions']}, "
                f"updated_races={summary['updated_races']}, "
                f"updated_sessions={summary['updated_sessions']}"
            )

        hydrated = 0
        if not args.skip_hydration:
            hydrated = hydrate_pending_sessions(db, target_years)

        print(
            f"Sync complete for seasons {', '.join(str(year) for year in target_years)}. "
            f"Hydrated sessions: {hydrated}."
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
