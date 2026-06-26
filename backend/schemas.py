from datetime import date

from pydantic import BaseModel, ConfigDict


class ORMBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SeasonRead(ORMBaseModel):
    id: int
    year: int


class GrandPrixRead(ORMBaseModel):
    id: int
    season_id: int
    round_number: int
    name: str
    country: str
    track_name: str
    date: date


class SessionRead(ORMBaseModel):
    id: int
    grand_prix_id: int
    session_index: int
    session_type: str
    air_temp: float
    track_temp: float
    wind_speed: float
    laps_hydrated: bool = False


class DriverRead(ORMBaseModel):
    id: int
    code: str
    driver_number: str | None = None
    name: str
    team: str


class LapRead(ORMBaseModel):
    id: int
    session_id: int
    driver_id: int
    lap_number: int
    lap_time: float | None = None
    sector1: float | None = None
    sector2: float | None = None
    sector3: float | None = None


class TelemetryPointPayload(BaseModel):
    timestamp: float
    speed: float
    rpm: int
    throttle: float
    brake: float
    distance: float
    x: float | None = None
    y: float | None = None


class TelemetryPointRead(ORMBaseModel):
    id: int | None = None
    lap_id: int
    timestamp: float
    speed: float
    rpm: int
    throttle: float
    brake: float
    distance: float
    x: float | None = None
    y: float | None = None


class LapSummary(BaseModel):
    lap_id: int
    lap_time: float | None = None
    sector1: float | None = None
    sector2: float | None = None
    sector3: float | None = None
    average_speed: float
    maximum_speed: float
    average_rpm: float
    average_throttle: float
    average_brake: float


class SessionDetailRead(BaseModel):
    session: SessionRead
    drivers: list[DriverRead]


class LapDetailRead(BaseModel):
    telemetry: list[TelemetryPointPayload]
    summary: LapSummary
    loading: bool = False
