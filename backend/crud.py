import threading
import time

from sqlalchemy.orm import Session, joinedload

from backend import models, schemas
from backend.database import SessionLocal
from backend.fastf1_data import (
    build_fallback_lap_telemetry,
    hydrate_session_metadata,
    is_session_metadata_hydrated,
    is_session_metadata_warming,
    load_real_lap_telemetry,
    schedule_session_metadata_warmup,
    schedule_session_telemetry_warmup,
)


CONTROL_ARTIFACT_THROTTLE_THRESHOLD = 85.0
CONTROL_ARTIFACT_BRAKE_THRESHOLD = 90.0
CONTROL_ARTIFACT_BRAKE_RUN_SECONDS = 6.0
WARMING_LAP_TELEMETRY_IDS: set[int] = set()
WARMING_LAP_TELEMETRY_LOCK = threading.Lock()
LAP_TELEMETRY_MEMORY_CACHE: dict[int, list[schemas.TelemetryPointRead]] = {}
LAP_TELEMETRY_MEMORY_CACHE_LOCK = threading.Lock()
FALLBACK_DELTA_RELATIVE_STDEV_THRESHOLD = 0.02
FALLBACK_DELTA_UNIQUE_THRESHOLD = 3


def _clamp_percent(value: float | None) -> float:
    if value is None:
        return 0.0
    return max(0.0, min(100.0, float(value)))


def _normalize_brake_value(value: float | None) -> float:
    if value is None:
        return 0.0
    brake = float(value)
    if 0.0 <= brake <= 1.0:
        return 100.0 if brake >= 0.5 else 0.0
    return _clamp_percent(brake)


def _normalize_control_values(throttle: float | None, brake: float | None) -> tuple[float, float]:
    throttle_value = _clamp_percent(throttle)
    brake_value = _normalize_brake_value(brake)

    if throttle_value >= CONTROL_ARTIFACT_THROTTLE_THRESHOLD and brake_value >= CONTROL_ARTIFACT_BRAKE_THRESHOLD:
        throttle_value = 0.0

    return round(throttle_value, 3), round(brake_value, 3)


def _sanitize_telemetry_points(telemetry_points, lap_id: int | None = None):
    sanitized_points = []
    for index, point in enumerate(telemetry_points, start=1):
        throttle, brake = _normalize_control_values(
            getattr(point, "throttle", None),
            getattr(point, "brake", None),
        )
        sanitized_points.append(
            schemas.TelemetryPointRead(
                id=getattr(point, "id", index),
                lap_id=getattr(point, "lap_id", lap_id) or lap_id or 0,
                timestamp=round(float(getattr(point, "timestamp", 0.0)), 3),
                speed=round(float(getattr(point, "speed", 0.0)), 3),
                rpm=int(getattr(point, "rpm", 0) or 0),
                throttle=throttle,
                brake=brake,
                distance=round(float(getattr(point, "distance", 0.0)), 3),
                x=getattr(point, "x", None),
                y=getattr(point, "y", None),
            )
        )
    return sanitized_points


def _has_control_channel_artifacts(telemetry_points) -> bool:
    if not telemetry_points:
        return False

    overlap_count = 0
    max_brake_run_duration = 0.0
    current_brake_run_start = None
    previous_timestamp = None

    for point in telemetry_points:
        throttle = float(getattr(point, "throttle", 0.0) or 0.0)
        brake = float(getattr(point, "brake", 0.0) or 0.0)
        timestamp = float(getattr(point, "timestamp", 0.0) or 0.0)
        normalized_brake = _normalize_brake_value(brake)

        if throttle < 0.0 or throttle > 100.0 or brake < 0.0 or brake > 100.0:
            return True

        if throttle >= CONTROL_ARTIFACT_THROTTLE_THRESHOLD and normalized_brake >= CONTROL_ARTIFACT_BRAKE_THRESHOLD:
            overlap_count += 1

        if normalized_brake >= CONTROL_ARTIFACT_BRAKE_THRESHOLD:
            if current_brake_run_start is None:
                current_brake_run_start = timestamp
        elif current_brake_run_start is not None:
            max_brake_run_duration = max(max_brake_run_duration, timestamp - current_brake_run_start)
            current_brake_run_start = None

        previous_timestamp = timestamp

    if current_brake_run_start is not None and previous_timestamp is not None:
        max_brake_run_duration = max(max_brake_run_duration, previous_timestamp - current_brake_run_start)

    return overlap_count >= 2 or max_brake_run_duration >= CONTROL_ARTIFACT_BRAKE_RUN_SECONDS


def _get_session_with_context(db: Session, session_id: int):
    return (
        db.query(models.Session)
        .options(joinedload(models.Session.grand_prix).joinedload(models.GrandPrix.season))
        .filter(models.Session.id == session_id)
        .first()
    )


def _session_has_laps(db: Session, session_id: int) -> bool:
    if _is_session_metadata_hydrated(db, session_id):
        return True
    return db.query(models.Lap.id).filter(models.Lap.session_id == session_id).first() is not None


def _is_session_metadata_hydrated(db: Session, session_id: int) -> bool:
    if is_session_metadata_hydrated(session_id):
        return True
    return bool(
        db.query(models.Session.laps_hydrated)
        .filter(models.Session.id == session_id)
        .scalar()
    )


def _wait_for_session_metadata(db: Session, session_id: int, timeout_seconds: float = 2.8) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        db.expire_all()
        if _is_session_metadata_hydrated(db, session_id):
            return True
        if not is_session_metadata_warming(session_id):
            return False
        time.sleep(0.1)
    db.expire_all()
    return _is_session_metadata_hydrated(db, session_id)


def _ensure_session_metadata(db: Session, session: models.Session):
    if _is_session_metadata_hydrated(db, session.id):
        return session

    if is_session_metadata_warming(session.id):
        if _wait_for_session_metadata(db, session.id):
            refreshed = _get_session_with_context(db, session.id)
            return refreshed or session
        # Metadata warmup is still running in the background.
        # Return the current session state so the frontend can poll again
        # instead of blocking on a second full hydration in this request.
        return session

    hydrate_session_metadata(db, session)
    refreshed = _get_session_with_context(db, session.id)
    return refreshed or session


def _get_session_drivers(db: Session, session_id: int):
    rows = (
        db.query(models.Driver, models.Lap.team)
        .join(models.Lap, models.Lap.driver_id == models.Driver.id)
        .filter(models.Lap.session_id == session_id)
        .distinct()
        .order_by(models.Driver.code.asc())
        .all()
    )
    return [
        schemas.DriverRead(
            id=driver.id,
            code=driver.code,
            driver_number=driver.driver_number,
            name=driver.name,
            team=team or driver.team,
        )
        for driver, team in rows
    ]


def _schedule_session_telemetry_from_session(session: models.Session | None) -> bool:
    if session is None:
        return False

    grand_prix = session.grand_prix
    if grand_prix is None or grand_prix.season is None:
        return False

    return schedule_session_telemetry_warmup(
        grand_prix.season.year,
        grand_prix.round_number,
        session.session_index,
    )


def _compact_telemetry_points(telemetry_points):
    return [
        schemas.TelemetryPointPayload(
            timestamp=point.timestamp,
            speed=point.speed,
            rpm=point.rpm,
            throttle=point.throttle,
            brake=point.brake,
            distance=point.distance,
            x=point.x,
            y=point.y,
        )
        for point in telemetry_points
    ]


def _build_lap_summary(lap: models.Lap, telemetry_points):
    if not telemetry_points:
        return schemas.LapSummary(
            lap_id=lap.id,
            lap_time=lap.lap_time,
            sector1=lap.sector1,
            sector2=lap.sector2,
            sector3=lap.sector3,
            average_speed=0.0,
            maximum_speed=0.0,
            average_rpm=0.0,
            average_throttle=0.0,
            average_brake=0.0,
        )

    total_points = len(telemetry_points)
    average_speed = sum(point.speed for point in telemetry_points) / total_points
    maximum_speed = max(point.speed for point in telemetry_points)
    average_rpm = sum(point.rpm for point in telemetry_points) / total_points
    average_throttle = sum(point.throttle for point in telemetry_points) / total_points
    average_brake = sum(point.brake for point in telemetry_points) / total_points

    return schemas.LapSummary(
        lap_id=lap.id,
        lap_time=lap.lap_time,
        sector1=lap.sector1,
        sector2=lap.sector2,
        sector3=lap.sector3,
        average_speed=round(average_speed, 2),
        maximum_speed=round(maximum_speed, 2),
        average_rpm=round(average_rpm, 2),
        average_throttle=round(average_throttle, 2),
        average_brake=round(average_brake, 2),
    )


def is_lap_telemetry_warming(lap_id: int) -> bool:
    with WARMING_LAP_TELEMETRY_LOCK:
        return lap_id in WARMING_LAP_TELEMETRY_IDS


def claim_lap_telemetry_warmup(lap_id: int) -> bool:
    with WARMING_LAP_TELEMETRY_LOCK:
        if lap_id in WARMING_LAP_TELEMETRY_IDS:
            return False
        WARMING_LAP_TELEMETRY_IDS.add(lap_id)
    return True


def release_lap_telemetry_warmup(lap_id: int) -> None:
    with WARMING_LAP_TELEMETRY_LOCK:
        WARMING_LAP_TELEMETRY_IDS.discard(lap_id)


def _get_memory_cached_telemetry_points(lap_id: int):
    with LAP_TELEMETRY_MEMORY_CACHE_LOCK:
        return LAP_TELEMETRY_MEMORY_CACHE.get(lap_id)


def _set_memory_cached_telemetry_points(lap_id: int, points) -> None:
    with LAP_TELEMETRY_MEMORY_CACHE_LOCK:
        LAP_TELEMETRY_MEMORY_CACHE[lap_id] = points


def _discard_memory_cached_telemetry_points(lap_id: int) -> None:
    with LAP_TELEMETRY_MEMORY_CACHE_LOCK:
        LAP_TELEMETRY_MEMORY_CACHE.pop(lap_id, None)


def _get_lap_with_context(db: Session, lap_id: int):
    return (
        db.query(models.Lap)
        .options(
            joinedload(models.Lap.driver),
            joinedload(models.Lap.session)
            .joinedload(models.Session.grand_prix)
            .joinedload(models.GrandPrix.season),
        )
        .filter(models.Lap.id == lap_id)
        .first()
    )


def _relative_delta_stdev(values: list[float]) -> float:
    if not values:
        return 0.0
    mean = sum(values) / len(values)
    if mean == 0:
        return 0.0
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return (variance ** 0.5) / abs(mean)


def _looks_like_fallback_telemetry(telemetry_points) -> bool:
    if not telemetry_points or len(telemetry_points) < 120:
        return False

    timestamps = [float(getattr(point, "timestamp", 0.0) or 0.0) for point in telemetry_points]
    distances = [float(getattr(point, "distance", 0.0) or 0.0) for point in telemetry_points]
    timestamp_deltas = [round(timestamps[index] - timestamps[index - 1], 6) for index in range(1, len(timestamps))]
    distance_deltas = [round(distances[index] - distances[index - 1], 6) for index in range(1, len(distances))]

    if not timestamp_deltas or not distance_deltas:
        return False

    unique_timestamp_deltas = len(set(timestamp_deltas[:80]))
    unique_distance_deltas = len(set(distance_deltas[:80]))
    timestamp_variation = _relative_delta_stdev(timestamp_deltas)
    distance_variation = _relative_delta_stdev(distance_deltas)

    return (
        unique_timestamp_deltas <= FALLBACK_DELTA_UNIQUE_THRESHOLD
        and unique_distance_deltas <= FALLBACK_DELTA_UNIQUE_THRESHOLD
        and timestamp_variation <= FALLBACK_DELTA_RELATIVE_STDEV_THRESHOLD
        and distance_variation <= FALLBACK_DELTA_RELATIVE_STDEV_THRESHOLD
    )


def _get_cached_telemetry_points(db: Session, lap_id: int):
    memory_cached_points = _get_memory_cached_telemetry_points(lap_id)
    if memory_cached_points is not None:
        if _looks_like_fallback_telemetry(memory_cached_points):
            _discard_memory_cached_telemetry_points(lap_id)
        else:
            return memory_cached_points

    stored_points = (
        db.query(models.TelemetryPoint)
        .filter(models.TelemetryPoint.lap_id == lap_id)
        .order_by(models.TelemetryPoint.timestamp.asc())
        .all()
    )
    if not stored_points:
        return None
    if _looks_like_fallback_telemetry(stored_points):
        db.query(models.TelemetryPoint).filter(models.TelemetryPoint.lap_id == lap_id).delete()
        db.commit()
        return None
    sanitized_points = _sanitize_telemetry_points(stored_points, lap_id=lap_id)
    _set_memory_cached_telemetry_points(lap_id, sanitized_points)
    return sanitized_points


def _wait_for_lap_telemetry(db: Session, lap_id: int, timeout_seconds: float = 4.5):
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        cached_points = _get_cached_telemetry_points(db, lap_id)
        if cached_points is not None:
            return cached_points
        if not is_lap_telemetry_warming(lap_id):
            return None
        time.sleep(0.08)
    return _get_cached_telemetry_points(db, lap_id)


def _persist_telemetry_points(db: Session, lap_id: int, points) -> None:
    if db.query(models.TelemetryPoint.id).filter(models.TelemetryPoint.lap_id == lap_id).first():
        return

    db_points = [
        models.TelemetryPoint(
            lap_id=lap_id,
            timestamp=point.timestamp,
            speed=point.speed,
            rpm=point.rpm,
            throttle=point.throttle,
            brake=point.brake,
            distance=point.distance,
            x=point.x,
            y=point.y,
        )
        for point in points
    ]
    db.add_all(db_points)
    db.commit()


def _run_lap_telemetry_persist(lap_id: int, points) -> None:
    db = SessionLocal()
    try:
        _persist_telemetry_points(db, lap_id, points)
    finally:
        db.close()


def _hydrate_lap_telemetry(db: Session, lap: models.Lap, *, persist_async: bool = False):
    points = load_real_lap_telemetry(lap)
    points = _sanitize_telemetry_points(points, lap_id=lap.id)
    _set_memory_cached_telemetry_points(lap.id, points)
    if not _looks_like_fallback_telemetry(points):
        if persist_async:
            threading.Thread(
                target=_run_lap_telemetry_persist,
                args=(lap.id, points),
                daemon=True,
                name=f"lap-telemetry-persist-{lap.id}",
            ).start()
        else:
            _persist_telemetry_points(db, lap.id, points)
    return points


def _build_and_cache_fallback_telemetry(db: Session, lap: models.Lap):
    points = _sanitize_telemetry_points(build_fallback_lap_telemetry(lap), lap_id=lap.id)
    _set_memory_cached_telemetry_points(lap.id, points)
    return points


def _run_lap_telemetry_warmup(lap_id: int) -> None:
    db = SessionLocal()
    try:
        cached_points = _get_cached_telemetry_points(db, lap_id)
        if cached_points is not None:
            return

        lap = _get_lap_with_context(db, lap_id)
        if lap is not None:
            _hydrate_lap_telemetry(db, lap)
    finally:
        db.close()
        release_lap_telemetry_warmup(lap_id)


def schedule_lap_telemetry_warmup(lap_id: int | None) -> bool:
    if not lap_id:
        return False
    if not claim_lap_telemetry_warmup(lap_id):
        return False

    threading.Thread(
        target=_run_lap_telemetry_warmup,
        args=(lap_id,),
        daemon=True,
        name=f"lap-telemetry-warmup-{lap_id}",
    ).start()
    return True


def _pick_lap_prefetch_candidates(laps: list[models.Lap]) -> list[models.Lap]:
    if not laps:
        return []

    candidates: list[models.Lap] = []
    seen_ids: set[int] = set()

    def add_candidate(lap: models.Lap | None) -> None:
        if lap is None or lap.id in seen_ids:
            return
        seen_ids.add(lap.id)
        candidates.append(lap)

    timed_laps = [lap for lap in laps if lap.lap_time is not None]
    complete_laps = [
        lap for lap in timed_laps
        if lap.sector1 is not None and lap.sector2 is not None and lap.sector3 is not None
    ]

    fastest_lap = min(timed_laps, key=lambda lap: lap.lap_time) if timed_laps else None
    fastest_complete_lap = min(complete_laps, key=lambda lap: lap.lap_time) if complete_laps else None

    add_candidate(fastest_lap)
    add_candidate(fastest_complete_lap)
    add_candidate(laps[0] if laps else None)
    add_candidate(laps[1] if len(laps) > 1 else None)
    return candidates[:4]


def get_seasons(db: Session):
    return db.query(models.Season).order_by(models.Season.year.desc()).all()


def get_races_by_season(db: Session, season_id: int):
    return (
        db.query(models.GrandPrix)
        .filter(models.GrandPrix.season_id == season_id)
        .order_by(models.GrandPrix.date.asc())
        .all()
    )


def get_sessions_by_race(db: Session, race_id: int):
    return (
        db.query(models.Session)
        .filter(models.Session.grand_prix_id == race_id)
        .order_by(models.Session.session_index.asc())
        .all()
    )


def get_drivers_by_session(db: Session, session_id: int):
    session = _get_session_with_context(db, session_id)
    if session is None:
        return []
    if not _is_session_metadata_hydrated(db, session_id):
        session = _ensure_session_metadata(db, session)

    # Start telemetry warmup as soon as the session context is opened so the
    # first lap click can reuse a partially prepared FastF1 session.
    if _is_session_metadata_hydrated(db, session_id):
        _schedule_session_telemetry_from_session(session)

    return _get_session_drivers(db, session_id)


def get_session_detail(db: Session, session_id: int):
    session = _get_session_with_context(db, session_id)
    if session is None:
        return None
    if not _is_session_metadata_hydrated(db, session_id):
        session = _ensure_session_metadata(db, session)

    # Warm telemetry one interaction earlier than `/laps`, which shortens the
    # perceived cold path for the common UI flow:
    # season -> race -> session-detail -> laps -> lap-detail.
    if _is_session_metadata_hydrated(db, session_id):
        _schedule_session_telemetry_from_session(session)

    return schemas.SessionDetailRead(
        session=session,
        drivers=_get_session_drivers(db, session_id),
    )


def warm_session_metadata(db: Session, session_id: int):
    session = _get_session_with_context(db, session_id)
    if session is None:
        return None
    if _is_session_metadata_hydrated(db, session_id):
        return False
    return schedule_session_metadata_warmup(session_id)


def warm_session_telemetry(db: Session, session_id: int):
    session = _get_session_with_context(db, session_id)
    if session is None:
        return None

    return _schedule_session_telemetry_from_session(session)


def get_laps(db: Session, session_id: int, driver_id: int):
    session = _get_session_with_context(db, session_id)
    if session is None:
        return []
    if not _is_session_metadata_hydrated(db, session_id):
        session = _ensure_session_metadata(db, session)

    laps = (
        db.query(models.Lap)
        .filter(models.Lap.session_id == session_id, models.Lap.driver_id == driver_id)
        .order_by(models.Lap.lap_number.asc())
        .all()
    )

    if laps:
        _schedule_session_telemetry_from_session(session)
        for lap in _pick_lap_prefetch_candidates(laps):
            schedule_lap_telemetry_warmup(lap.id)

    return laps


def get_telemetry_points(db: Session, lap_id: int):
    cached_points = _get_cached_telemetry_points(db, lap_id)
    if cached_points is not None:
        return cached_points

    if is_lap_telemetry_warming(lap_id):
        warmed_points = _wait_for_lap_telemetry(db, lap_id)
        if warmed_points is not None:
            return warmed_points

    lap = _get_lap_with_context(db, lap_id)
    if lap is None:
        return []

    if not claim_lap_telemetry_warmup(lap_id):
        warmed_points = _wait_for_lap_telemetry(db, lap_id)
        if warmed_points is not None:
            return warmed_points
        return _hydrate_lap_telemetry(db, lap, persist_async=True)

    try:
        return _hydrate_lap_telemetry(db, lap, persist_async=True)
    except Exception:
        return _build_and_cache_fallback_telemetry(db, lap)
    finally:
        release_lap_telemetry_warmup(lap_id)


def get_lap_summary(db: Session, lap_id: int):
    lap = db.query(models.Lap).filter(models.Lap.id == lap_id).first()
    if lap is None:
        return None

    telemetry_points = get_telemetry_points(db, lap_id)
    return _build_lap_summary(lap, telemetry_points)


def get_lap_detail(db: Session, lap_id: int):
    lap = db.query(models.Lap).filter(models.Lap.id == lap_id).first()
    if lap is None:
        return None

    # Fast path: check memory cache and DB first (no blocking).
    telemetry_points = _get_cached_telemetry_points(db, lap_id)

    if telemetry_points is None:
        # Ensure warmup is scheduled so data will be ready on retry.
        schedule_lap_telemetry_warmup(lap_id)

        # Wait briefly — covers the common case where the session is already
        # in the FastF1 LRU cache (lap extraction takes <200 ms).
        if is_lap_telemetry_warming(lap_id):
            telemetry_points = _wait_for_lap_telemetry(db, lap_id, timeout_seconds=0.6)

    if telemetry_points is None:
        if is_lap_telemetry_warming(lap_id):
            return schemas.LapDetailRead(
                telemetry=[],
                summary=_build_lap_summary(lap, []),
                loading=True,
            )
        try:
            telemetry_points = _hydrate_lap_telemetry(db, lap, persist_async=True)
        except Exception:
            telemetry_points = _build_and_cache_fallback_telemetry(db, lap)

    return schemas.LapDetailRead(
        telemetry=_compact_telemetry_points(telemetry_points),
        summary=_build_lap_summary(lap, telemetry_points),
        loading=False,
    )
