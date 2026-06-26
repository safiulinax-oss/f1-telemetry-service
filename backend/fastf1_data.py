from __future__ import annotations

from datetime import date
from functools import lru_cache
import math
from pathlib import Path
import threading
import unicodedata

import fastf1
import pandas as pd
from sqlalchemy.orm import joinedload

from backend.database import SessionLocal
from backend.models import Driver, GrandPrix, Lap, Season, Session, TelemetryPoint
from backend.schemas import TelemetryPointRead


BASE_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = BASE_DIR / ".fastf1_cache"
CACHE_DIR.mkdir(exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)


EVENT_CIRCUITS = {
    "Australian Grand Prix": "Albert Park Circuit",
    "Austrian Grand Prix": "Red Bull Ring",
    "Bahrain Grand Prix": "Bahrain International Circuit",
    "Barcelona Grand Prix": "Circuit de Barcelona-Catalunya",
    "Belgian Grand Prix": "Circuit de Spa-Francorchamps",
    "Brazilian Grand Prix": "Autodromo Jose Carlos Pace",
    "British Grand Prix": "Silverstone Circuit",
    "Canadian Grand Prix": "Circuit Gilles Villeneuve",
    "Chinese Grand Prix": "Shanghai International Circuit",
    "Dutch Grand Prix": "Circuit Zandvoort",
    "Eifel Grand Prix": "Nurburgring",
    "Azerbaijan Grand Prix": "Baku City Circuit",
    "Emilia Romagna Grand Prix": "Autodromo Enzo e Dino Ferrari",
    "French Grand Prix": "Circuit Paul Ricard",
    "German Grand Prix": "Hockenheimring",
    "Hungarian Grand Prix": "Hungaroring",
    "Italian Grand Prix": "Monza",
    "Miami Grand Prix": "Miami International Autodrome",
    "Mexican Grand Prix": "Autodromo Hermanos Rodriguez",
    "Mexico City Grand Prix": "Autodromo Hermanos Rodriguez",
    "Monaco Grand Prix": "Circuit de Monaco",
    "Japanese Grand Prix": "Suzuka Circuit",
    "Las Vegas Grand Prix": "Las Vegas Strip Circuit",
    "Portuguese Grand Prix": "Algarve International Circuit",
    "Qatar Grand Prix": "Lusail International Circuit",
    "Russian Grand Prix": "Sochi Autodrom",
    "Sakhir Grand Prix": "Bahrain International Circuit",
    "Saudi Arabian Grand Prix": "Jeddah Corniche Circuit",
    "Sao Paulo Grand Prix": "Autodromo Jose Carlos Pace",
    "Singapore Grand Prix": "Marina Bay Street Circuit",
    "Spanish Grand Prix": "Circuit de Barcelona-Catalunya",
    "Styrian Grand Prix": "Red Bull Ring",
    "Turkish Grand Prix": "Intercity Istanbul Park",
    "Tuscan Grand Prix": "Mugello Circuit",
    "Qatar Grand Prix": "Lusail International Circuit",
    "United States Grand Prix": "Circuit of the Americas",
    "Abu Dhabi Grand Prix": "Yas Marina Circuit",
    "70th Anniversary Grand Prix": "Silverstone Circuit",
}
EVENT_CIRCUITS = {unicodedata.normalize("NFKD", key).encode("ascii", "ignore").decode("ascii"): value for key, value in EVENT_CIRCUITS.items()}

SESSION_NAME_COLUMNS = ["Session1", "Session2", "Session3", "Session4", "Session5"]
WARMING_SESSIONS: set[tuple[int, int, int]] = set()
WARMING_SESSIONS_LOCK = threading.Lock()
HYDRATED_SESSION_IDS: set[int] = set()
HYDRATED_SESSION_IDS_LOCK = threading.Lock()
WARMING_SESSION_METADATA_IDS: set[int] = set()
WARMING_SESSION_METADATA_IDS_LOCK = threading.Lock()
IN_FLIGHT_FASTF1_SESSION_LOADS: dict[tuple[int, int, int, bool, bool], threading.Event] = {}
IN_FLIGHT_FASTF1_SESSION_LOADS_LOCK = threading.Lock()


def _seconds_from_timedelta(value) -> float | None:
    if pd.isna(value):
        return None
    return round(value.total_seconds(), 3)


def sanitize_text(value: object) -> str:
    text = str(value or "")
    normalized = unicodedata.normalize("NFKD", text)
    return normalized.encode("ascii", "ignore").decode("ascii")


def _mean_weather_value(weather_data: pd.DataFrame, column: str) -> float:
    if column not in weather_data:
        return 0.0
    series = weather_data[column].dropna()
    if series.empty:
        return 0.0
    return round(float(series.mean()), 1)


def get_event_schedule(year: int) -> pd.DataFrame:
    return fastf1.get_event_schedule(year, include_testing=False)


@lru_cache(maxsize=32)
def _load_fastf1_session_cached(
    year: int,
    round_number: int,
    session_index: int,
    telemetry: bool,
    weather: bool = True,
):
    session = fastf1.get_session(year, round_number, session_index)
    session.load(laps=True, telemetry=telemetry, weather=weather, messages=False)
    return session


def load_fastf1_session(
    year: int,
    round_number: int,
    session_index: int,
    telemetry: bool,
    weather: bool = True,
):
    key = (year, round_number, session_index, telemetry, weather)

    with IN_FLIGHT_FASTF1_SESSION_LOADS_LOCK:
        wait_event = IN_FLIGHT_FASTF1_SESSION_LOADS.get(key)
        if wait_event is None:
            wait_event = threading.Event()
            IN_FLIGHT_FASTF1_SESSION_LOADS[key] = wait_event
            is_loader = True
        else:
            is_loader = False

    if is_loader:
        try:
            return _load_fastf1_session_cached(year, round_number, session_index, telemetry, weather)
        finally:
            with IN_FLIGHT_FASTF1_SESSION_LOADS_LOCK:
                wait_event.set()
                IN_FLIGHT_FASTF1_SESSION_LOADS.pop(key, None)

    wait_event.wait()
    return _load_fastf1_session_cached(year, round_number, session_index, telemetry, weather)


def _run_session_telemetry_warmup(year: int, round_number: int, session_index: int):
    key = (year, round_number, session_index)
    try:
        load_fastf1_session(year, round_number, session_index, telemetry=True, weather=False)
    finally:
        with WARMING_SESSIONS_LOCK:
            WARMING_SESSIONS.discard(key)


def schedule_session_telemetry_warmup(year: int, round_number: int, session_index: int) -> bool:
    key = (year, round_number, session_index)
    with WARMING_SESSIONS_LOCK:
        if key in WARMING_SESSIONS:
            return False
        WARMING_SESSIONS.add(key)

    threading.Thread(
        target=_run_session_telemetry_warmup,
        args=key,
        daemon=True,
        name=f"fastf1-warmup-{year}-{round_number}-{session_index}",
    ).start()
    return True


def iter_event_sessions(event_row) -> list[tuple[int, str]]:
    sessions = []
    for index, column in enumerate(SESSION_NAME_COLUMNS, start=1):
        session_name = event_row[column]
        if pd.notna(session_name):
            sessions.append((index, str(session_name)))
    return sessions


def circuit_name_for_event(event_name: str, fallback_location: str) -> str:
    return EVENT_CIRCUITS.get(sanitize_text(event_name), fallback_location)


def _get_weather_data(live_session) -> pd.DataFrame:
    try:
        weather_data = live_session.weather_data
    except Exception:
        return pd.DataFrame()
    return weather_data if weather_data is not None else pd.DataFrame()


def _session_has_laps(db, session_id: int) -> bool:
    return db.query(Lap.id).filter(Lap.session_id == session_id).first() is not None


def is_session_metadata_hydrated(session_id: int) -> bool:
    with HYDRATED_SESSION_IDS_LOCK:
        return session_id in HYDRATED_SESSION_IDS


def _mark_session_metadata_hydrated(session_id: int) -> None:
    with HYDRATED_SESSION_IDS_LOCK:
        HYDRATED_SESSION_IDS.add(session_id)


def claim_session_metadata_warmup(session_id: int) -> bool:
    with WARMING_SESSION_METADATA_IDS_LOCK:
        if session_id in WARMING_SESSION_METADATA_IDS:
            return False
        WARMING_SESSION_METADATA_IDS.add(session_id)
    return True


def release_session_metadata_warmup(session_id: int) -> None:
    with WARMING_SESSION_METADATA_IDS_LOCK:
        WARMING_SESSION_METADATA_IDS.discard(session_id)


def is_session_metadata_warming(session_id: int) -> bool:
    with WARMING_SESSION_METADATA_IDS_LOCK:
        return session_id in WARMING_SESSION_METADATA_IDS


def _extract_session_laps(live_session) -> pd.DataFrame:
    try:
        laps = live_session.laps
    except Exception:
        return pd.DataFrame()
    if laps is None or laps.empty:
        return pd.DataFrame()
    return laps[
        laps["Driver"].notna() & laps["LapNumber"].notna()
    ]


def rotate_track_coordinates(x: float, y: float, rotation_degrees: float) -> tuple[float, float]:
    angle = math.radians(rotation_degrees)
    x_rotated = x * math.cos(angle) + y * math.sin(angle)
    y_rotated = -x * math.sin(angle) + y * math.cos(angle)
    return x_rotated, y_rotated


def build_real_season_dataset(db, year: int = 2023) -> tuple[int, int, int]:
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
    season = Season(year=year)
    db.add(season)
    db.flush()

    total_sessions = 0

    for event_row in schedule.itertuples(index=False):
        round_number = int(event_row.RoundNumber)
        event_name = sanitize_text(event_row.EventName)
        track_name = sanitize_text(circuit_name_for_event(str(event_row.EventName), str(event_row.Location)))
        grand_prix = GrandPrix(
            season=season,
            round_number=round_number,
            name=event_name,
            country=sanitize_text(event_row.Country),
            track_name=track_name,
            date=event_row.EventDate.date() if hasattr(event_row.EventDate, "date") else date.fromisoformat(str(event_row.EventDate)),
        )
        db.add(grand_prix)
        db.flush()

        for session_index, session_name in iter_event_sessions(event_row._asdict()):
            session_model = Session(
                grand_prix=grand_prix,
                session_index=session_index,
                session_type=session_name,
                air_temp=0.0,
                track_temp=0.0,
                wind_speed=0.0,
            )
            db.add(session_model)
            total_sessions += 1

            db.commit()
        print(f"Prepared {event_name}")

    return len(schedule), total_sessions, 0


def hydrate_session_metadata(db, session_model: Session) -> Session:
    if getattr(session_model, "laps_hydrated", False):
        return session_model

    grand_prix = session_model.grand_prix
    year = grand_prix.season.year
    live_session = load_fastf1_session(
        year,
        grand_prix.round_number,
        session_model.session_index,
        telemetry=False,
        weather=True,
    )
    weather_data = _get_weather_data(live_session)

    session_model.session_type = live_session.name or session_model.session_type
    session_model.air_temp = _mean_weather_value(weather_data, "AirTemp")
    session_model.track_temp = _mean_weather_value(weather_data, "TrackTemp")
    session_model.wind_speed = _mean_weather_value(weather_data, "WindSpeed")

    valid_laps = _extract_session_laps(live_session)
    if valid_laps.empty:
        session_model.laps_hydrated = True
        db.commit()
        _mark_session_metadata_hydrated(session_model.id)
        return session_model

    driver_codes = sorted({str(driver_code) for driver_code in valid_laps["Driver"].dropna().unique()})
    existing_drivers = {
        driver.code: driver
        for driver in db.query(Driver).filter(Driver.code.in_(driver_codes)).all()
    }
    existing_laps = {
        (driver_code, lap_number): lap_model
        for driver_code, lap_number, lap_model in (
            db.query(Driver.code, Lap.lap_number, Lap)
            .join(Lap, Lap.driver_id == Driver.id)
            .filter(Lap.session_id == session_model.id)
            .all()
        )
    }
    laps_to_insert: list[Lap] = []

    for lap in valid_laps.itertuples():
        driver_code = str(lap.Driver)
        lap_number = int(lap.LapNumber)
        driver_info = live_session.get_driver(driver_code)
        driver = existing_drivers.get(driver_code)
        driver_team = sanitize_text(driver_info.get("TeamName") or getattr(lap, "Team", "") or "Unknown Team")
        if driver is None:
            driver = Driver(
                code=driver_code,
                driver_number=str(driver_info.get("DriverNumber") or ""),
                name=sanitize_text(driver_info.get("FullName") or driver_code),
                team=driver_team,
            )
            db.add(driver)
            existing_drivers[driver_code] = driver
        else:
            driver.driver_number = str(driver_info.get("DriverNumber") or driver.driver_number or "")
            driver.name = sanitize_text(driver_info.get("FullName") or driver.name)
            driver.team = sanitize_text(driver_info.get("TeamName") or getattr(lap, "Team", "") or driver.team or "Unknown Team")

        sector1 = _seconds_from_timedelta(lap.Sector1Time)
        sector2 = _seconds_from_timedelta(lap.Sector2Time)
        sector3 = _seconds_from_timedelta(lap.Sector3Time)
        lap_time = _seconds_from_timedelta(lap.LapTime)
        lap_team = sanitize_text(driver_info.get("TeamName") or getattr(lap, "Team", "") or driver.team or "Unknown Team")
        existing_lap = existing_laps.get((driver_code, lap_number))

        if existing_lap is None:
            existing_lap = Lap(
                session=session_model,
                driver=driver,
                lap_number=lap_number,
                team=lap_team,
            )
            laps_to_insert.append(existing_lap)
            existing_laps[(driver_code, lap_number)] = existing_lap

        existing_lap.team = lap_team
        existing_lap.lap_time = lap_time
        existing_lap.sector1 = sector1
        existing_lap.sector2 = sector2
        existing_lap.sector3 = sector3

    if laps_to_insert:
        db.add_all(laps_to_insert)

    session_model.laps_hydrated = True
    db.commit()
    _mark_session_metadata_hydrated(session_model.id)
    return session_model


def _run_session_metadata_warmup(session_id: int) -> None:
    db = SessionLocal()
    try:
        session_model = (
            db.query(Session)
            .options(joinedload(Session.grand_prix).joinedload(GrandPrix.season))
            .filter(Session.id == session_id)
            .first()
        )
        if session_model is not None:
            hydrate_session_metadata(db, session_model)
    finally:
        db.close()
        release_session_metadata_warmup(session_id)


def schedule_session_metadata_warmup(session_id: int) -> bool:
    if is_session_metadata_hydrated(session_id):
        return False

    if not claim_session_metadata_warmup(session_id):
        return False

    threading.Thread(
        target=_run_session_metadata_warmup,
        args=(session_id,),
        daemon=True,
        name=f"session-metadata-warmup-{session_id}",
    ).start()
    return True


def _load_live_lap_telemetry_frame(live_lap):
    telemetry = live_lap.get_car_data().add_distance()
    try:
        telemetry = telemetry.merge_channels(live_lap.get_pos_data(), frequency="original")
    except Exception:
        pass
    return telemetry


def _clamp_percent(value: float | None) -> float | None:
    if value is None:
        return None
    return max(0.0, min(100.0, float(value)))


def _normalize_brake_channel_value(value) -> float | None:
    if pd.isna(value):
        return None
    if isinstance(value, bool):
        return 100.0 if bool(value) else 0.0

    brake = float(value)
    # FastF1 brake can be delivered as a binary 0/1 channel for some sessions.
    if 0.0 <= brake <= 1.0:
        return 100.0 if brake >= 0.5 else 0.0
    return _clamp_percent(brake)


def _normalize_control_channels(throttle: float | None, brake: float | None) -> tuple[float | None, float | None]:
    throttle = _clamp_percent(throttle)
    brake = _normalize_brake_channel_value(brake)
    if throttle is None:
        return throttle, brake
    if brake is None:
        return throttle, 0.0

    # Simultaneous full throttle and full brake is a telemetry artifact for this dashboard.
    if throttle >= 85.0 and brake >= 90.0:
        throttle = 0.0

    return throttle, brake


def _build_fallback_lap_telemetry(lap: Lap) -> list[TelemetryPointRead]:
    lap_time = max(float(lap.lap_time or 0.0), 60.0)
    point_count = max(420, min(900, int(lap_time * 8)))
    average_speed_kmh = max(150.0, min(245.0, 3600.0 * 5.25 / lap_time))
    track_length_m = average_speed_kmh * (lap_time / 3.6)
    phase_shift = (lap.id % 31) / 31
    shape_shift = (lap.driver_id % 17) / 17

    points: list[TelemetryPointRead] = []
    for index in range(point_count):
        progress = index / max(point_count - 1, 1)
        angle = 2 * math.pi * progress
        fast_wave = 0.5 + 0.5 * math.sin((progress * 6 + phase_shift) * 2 * math.pi)
        slow_wave = 0.5 + 0.5 * math.sin((progress * 3 + shape_shift) * 2 * math.pi)
        corner_intensity = min(1.0, 0.68 * fast_wave + 0.32 * slow_wave)
        brake = max(0.0, min(100.0, ((corner_intensity - 0.52) / 0.48) * 100))
        throttle = max(8.0, min(100.0, 100.0 - brake * 0.92 + (1.0 - slow_wave) * 10.0))
        speed = max(82.0, min(338.0, 88.0 + (1.0 - corner_intensity) * 244.0))
        rpm = int(max(7800, min(12450, 7600 + speed * 14.5 + throttle * 9.0 - brake * 6.0)))
        radius_x = 205 + 34 * math.sin(angle * 3 + shape_shift * math.pi)
        radius_y = 145 + 24 * math.cos(angle * 2 + phase_shift * math.pi)
        x = round(radius_x * math.cos(angle) + 28 * math.sin(angle * 2.5), 3)
        y = round(radius_y * math.sin(angle) + 22 * math.cos(angle * 1.5), 3)

        points.append(
            TelemetryPointRead(
                id=index + 1,
                lap_id=lap.id,
                timestamp=round(lap_time * progress, 3),
                speed=round(speed, 3),
                rpm=rpm,
                throttle=round(throttle, 3),
                brake=round(brake, 3),
                distance=round(track_length_m * progress, 3),
                x=x,
                y=y,
            )
        )

    return points


def build_fallback_lap_telemetry(lap: Lap) -> list[TelemetryPointRead]:
    return _build_fallback_lap_telemetry(lap)


def load_real_lap_telemetry(lap: Lap) -> list[TelemetryPointRead]:
    grand_prix = lap.session.grand_prix
    season_year = grand_prix.season.year
    live_session = load_fastf1_session(
        season_year,
        grand_prix.round_number,
        lap.session.session_index,
        telemetry=True,
        weather=False,
    )

    live_laps = live_session.laps.pick_drivers(lap.driver.code)
    if live_laps.empty:
        return _build_fallback_lap_telemetry(lap)

    selected = live_laps[live_laps["LapNumber"] == lap.lap_number]
    if selected.empty:
        return _build_fallback_lap_telemetry(lap)

    live_lap = selected.iloc[0]
    try:
        telemetry = _load_live_lap_telemetry_frame(live_lap).dropna(
            subset=["Time", "Distance", "Speed", "RPM", "Throttle"]
        ).copy()
    except Exception:
        return _build_fallback_lap_telemetry(lap)
    if telemetry.empty:
        return _build_fallback_lap_telemetry(lap)
    try:
        circuit_info = live_session.get_circuit_info()
    except Exception:
        circuit_info = None
    track_rotation = float(getattr(circuit_info, "rotation", 0.0) or 0.0)

    points: list[TelemetryPointRead] = []
    for index, row in enumerate(telemetry.itertuples(index=False), start=1):
        timestamp = _seconds_from_timedelta(row.Time)
        distance = None if pd.isna(row.Distance) else float(row.Distance)
        speed = None if pd.isna(row.Speed) else float(row.Speed)
        rpm = None if pd.isna(row.RPM) else int(row.RPM)
        throttle = None if pd.isna(row.Throttle) else float(row.Throttle)
        brake = _normalize_brake_channel_value(row.Brake)
        row_x = getattr(row, "X", None)
        row_y = getattr(row, "Y", None)
        x = None if pd.isna(row_x) else float(row_x)
        y = None if pd.isna(row_y) else float(row_y)
        if x is not None and y is not None and track_rotation:
            x, y = rotate_track_coordinates(x, y, track_rotation)
        if x is not None:
            x = round(x, 3)
        if y is not None:
            y = round(y, 3)

        throttle, brake = _normalize_control_channels(throttle, brake)
        if None in (timestamp, distance, speed, rpm, throttle):
            continue

        points.append(
            TelemetryPointRead(
                id=index,
                lap_id=lap.id,
                timestamp=round(timestamp, 3),
                speed=round(speed, 3),
                rpm=rpm,
                throttle=round(throttle, 3),
                brake=round(brake, 3),
                distance=round(distance, 3),
                x=x,
                y=y,
            )
        )

    if not points:
        return _build_fallback_lap_telemetry(lap)
    return points


def cache_real_lap_telemetry(db, lap: Lap, points: list[TelemetryPointRead]) -> None:
    db_points = []
    for point in points:
        db_points.append(
            TelemetryPoint(
                lap_id=lap.id,
                timestamp=point.timestamp,
                speed=point.speed,
                rpm=point.rpm,
                throttle=point.throttle,
                brake=point.brake,
                distance=point.distance,
                x=point.x,
                y=point.y,
            )
        )
    db.add_all(db_points)
    db.commit()
