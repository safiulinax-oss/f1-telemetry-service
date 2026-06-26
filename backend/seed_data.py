from datetime import date

from backend.database import Base, SessionLocal, engine, ensure_schema_compatibility
from backend.fastf1_data import build_real_season_dataset, get_event_schedule


SUPPORTED_SEASON_START_YEAR = 2018


def detect_supported_season_years(start_year: int = SUPPORTED_SEASON_START_YEAR, end_year: int | None = None) -> list[int]:
    today = date.today()
    max_year = end_year or today.year
    supported_years: list[int] = []

    for year in range(start_year, max_year + 1):
        try:
            schedule = get_event_schedule(year)
        except Exception as exc:
            print(f"Skipping {year}: schedule unavailable ({exc})")
            continue

        if schedule is None or schedule.empty:
            print(f"Skipping {year}: empty schedule.")
            continue

        if year >= today.year:
            schedule = schedule[
                schedule["EventDate"].apply(
                    lambda value: (
                        value.date() if hasattr(value, "date") else date.fromisoformat(str(value))
                    ) <= today
                )
            ]
            if schedule.empty:
                print(f"Skipping {year}: no completed events yet.")
                continue

        supported_years.append(year)

    return supported_years


def seed_demo_data(years: list[int] | None = None):
    selected_years = years or detect_supported_season_years()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()

    db = SessionLocal()
    try:
        total_races = 0
        total_sessions = 0
        total_laps = 0

        for year in selected_years:
            race_count, session_count, lap_count = build_real_season_dataset(db, year=year)
            total_races += race_count
            total_sessions += session_count
            total_laps += lap_count
            print(
                f"Real {year} season imported successfully: "
                f"{race_count} grands prix, "
                f"{session_count} sessions, "
                f"{lap_count} laps."
            )

        print(
            f"Imported seasons {', '.join(str(year) for year in selected_years)}: "
            f"{total_races} grands prix, "
            f"{total_sessions} sessions, "
            f"{total_laps} laps."
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
