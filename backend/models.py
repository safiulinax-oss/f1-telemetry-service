from sqlalchemy import Boolean, Column, Date, Float, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.database import Base


class Season(Base):
    __tablename__ = "seasons"

    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, unique=True, nullable=False, index=True)

    grand_prixes = relationship("GrandPrix", back_populates="season", cascade="all, delete")


class GrandPrix(Base):
    __tablename__ = "grand_prixes"

    id = Column(Integer, primary_key=True, index=True)
    season_id = Column(Integer, ForeignKey("seasons.id"), nullable=False, index=True)
    round_number = Column(Integer, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    track_name = Column(String(100), nullable=False)
    date = Column(Date, nullable=False)

    season = relationship("Season", back_populates="grand_prixes")
    sessions = relationship("Session", back_populates="grand_prix", cascade="all, delete")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    grand_prix_id = Column(Integer, ForeignKey("grand_prixes.id"), nullable=False, index=True)
    session_index = Column(Integer, nullable=False, index=True)
    session_type = Column(String(50), nullable=False)
    air_temp = Column(Float, nullable=False)
    track_temp = Column(Float, nullable=False)
    wind_speed = Column(Float, nullable=False)
    laps_hydrated = Column(Boolean, nullable=False, default=False, server_default="false")

    grand_prix = relationship("GrandPrix", back_populates="sessions")
    laps = relationship("Lap", back_populates="session", cascade="all, delete")


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, nullable=False, index=True)
    driver_number = Column(String(10), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    team = Column(String(100), nullable=False)

    laps = relationship("Lap", back_populates="driver", cascade="all, delete")


class Lap(Base):
    __tablename__ = "laps"
    __table_args__ = (
        UniqueConstraint("session_id", "driver_id", "lap_number", name="uq_lap_per_driver_session"),
        Index("ix_laps_session_driver", "session_id", "driver_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=False, index=True)
    lap_number = Column(Integer, nullable=False)
    team = Column(String(100), nullable=False)
    lap_time = Column(Float, nullable=True)
    sector1 = Column(Float, nullable=True)
    sector2 = Column(Float, nullable=True)
    sector3 = Column(Float, nullable=True)

    session = relationship("Session", back_populates="laps")
    driver = relationship("Driver", back_populates="laps")
    telemetry_points = relationship(
        "TelemetryPoint",
        back_populates="lap",
        cascade="all, delete",
        order_by="TelemetryPoint.timestamp",
    )


class TelemetryPoint(Base):
    __tablename__ = "telemetry_points"
    __table_args__ = (
        Index("ix_telemetry_lap_timestamp", "lap_id", "timestamp"),
    )

    id = Column(Integer, primary_key=True, index=True)
    lap_id = Column(Integer, ForeignKey("laps.id"), nullable=False, index=True)
    timestamp = Column(Float, nullable=False)
    speed = Column(Float, nullable=False)
    rpm = Column(Integer, nullable=False)
    throttle = Column(Float, nullable=False)
    brake = Column(Float, nullable=False)
    distance = Column(Float, nullable=False)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)

    lap = relationship("Lap", back_populates="telemetry_points")
