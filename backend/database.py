import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency for local env loading
    def load_dotenv():
        return False


load_dotenv()


def build_database_url() -> str:
    explicit_database_url = os.getenv("DATABASE_URL")
    if explicit_database_url:
        if not explicit_database_url.startswith(("postgresql://", "postgresql+psycopg://")):
            raise RuntimeError("DATABASE_URL must point to a PostgreSQL database.")
        return explicit_database_url

    postgres_host = os.getenv("POSTGRES_HOST")
    postgres_db = os.getenv("POSTGRES_DB")
    postgres_user = os.getenv("POSTGRES_USER")
    postgres_password = os.getenv("POSTGRES_PASSWORD")
    postgres_port = os.getenv("POSTGRES_PORT", "5432")

    if all([postgres_host, postgres_db, postgres_user, postgres_password]):
        return (
            "postgresql+psycopg://"
            f"{quote_plus(postgres_user)}:{quote_plus(postgres_password)}"
            f"@{postgres_host}:{postgres_port}/{postgres_db}"
        )

    raise RuntimeError(
        "PostgreSQL configuration is required. Set DATABASE_URL or POSTGRES_HOST, POSTGRES_DB, "
        "POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_PORT."
    )


DATABASE_URL = build_database_url()
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def ensure_schema_compatibility() -> None:
    if engine.dialect.name != "postgresql":
        return

    statements = [
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS laps_hydrated BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE laps ALTER COLUMN lap_time DROP NOT NULL",
        "ALTER TABLE laps ALTER COLUMN sector1 DROP NOT NULL",
        "ALTER TABLE laps ALTER COLUMN sector2 DROP NOT NULL",
        "ALTER TABLE laps ALTER COLUMN sector3 DROP NOT NULL",
        "CREATE INDEX IF NOT EXISTS ix_laps_session_driver ON laps (session_id, driver_id)",
        "CREATE INDEX IF NOT EXISTS ix_telemetry_lap_timestamp ON telemetry_points (lap_id, timestamp)",
    ]

    raw_connection = engine.raw_connection()
    try:
        cursor = raw_connection.cursor()
        for statement in statements:
            cursor.execute(statement)
        raw_connection.commit()
    finally:
        raw_connection.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
