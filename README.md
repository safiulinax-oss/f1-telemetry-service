# Web service for access and visualization of historical racing telemetry data

This diploma project is an educational full-stack web service for browsing historical Formula-style racing telemetry. The system lets a user select a season, grand prix, session, driver and lap, then view telemetry visualizations, a colored track overlay and computed lap statistics in a modern dashboard.

## Technology stack

Backend:
- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- Pydantic

Frontend:
- HTML
- CSS
- JavaScript
- Plotly.js

## Project structure

```text
telemetry_service/
├── .env.example
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── crud.py
│   ├── seed_data.py
│   └── routers/
│       ├── seasons.py
│       ├── races.py
│       ├── sessions.py
│       ├── drivers.py
│       ├── laps.py
│       └── telemetry.py
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── docker-compose.yml
├── requirements.txt
└── README.md
```

## Features

- Hierarchical telemetry navigation: season -> grand prix -> session -> driver -> lap
- Historical telemetry visualization only
- Speed and RPM chart
- Throttle and brake chart
- Time slider with synchronized cursor marker
- Track map overlay colored by acceleration, coasting and braking
- Lap summary statistics computed from telemetry
- Full synthetic 2023 season dataset

## Database entities

- `Season`
- `GrandPrix`
- `Session`
- `Driver`
- `Lap`
- `TelemetryPoint`

The schema supports multiple seasons, races, sessions, drivers and laps.

## API endpoints

- `GET /seasons`
- `GET /races?season_id=`
- `GET /sessions?race_id=`
- `GET /drivers?session_id=`
- `GET /laps?session_id=&driver_id=`
- `GET /telemetry?lap_id=`
- `GET /lap-summary?lap_id=`

## Demonstration seed data

The seed script rebuilds the active PostgreSQL database with a full synthetic Formula-style 2023 season:

- Season: `2023`
- Grand Prix weekends: `22`
- Sessions per weekend: `Practice`, `Qualifying`, `Race`
- Drivers: all race-weekend lineups for the season, including AlphaTauri substitutions
- Laps: full lap lists for every seeded driver in every seeded session

Telemetry is generated on demand for the selected lap instead of being precomputed for the whole database. Each requested lap produces approximately `1000` telemetry points using a deterministic profile tuned to the selected circuit style.

## Setup instructions

### 1. Create and activate a virtual environment

Windows PowerShell:

```powershell
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
py -3 -m pip install -r requirements.txt
```

### 3. Configure the database connection

Copy `.env.example` to `.env` and adjust the values if needed:

```powershell
Copy-Item .env.example .env
```

PostgreSQL is required. Configure either `DATABASE_URL` or the `POSTGRES_*` variables before starting the application.

### 4. Start PostgreSQL

Recommended local option:

```powershell
docker compose up -d postgres
```

### 5. Create tables and insert demo data

The seed script rebuilds the active PostgreSQL database and inserts the full synthetic 2023 season.

```powershell
py -3 -m backend.seed_data
```

If you need to refresh the project with newly completed real race weekends without wiping the database, run:

```powershell
py -3 -m backend.update_data
```

To only add missing seasons/races/sessions and skip driver/lap hydration, run:

```powershell
py -3 -m backend.update_data --skip-hydration
```

### 6. Start the FastAPI server

```powershell
uvicorn backend.main:app --reload
```

Start the server from the `telemetry_service` directory.

### 7. Open the dashboard

Open the application in your browser:

- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/docs`

## Frontend behavior

When the page loads:

1. Seasons are loaded from the backend.
2. The selection chain continues through races, sessions, drivers and laps.
3. After a lap is selected, the dashboard renders speed/RPM charts, throttle/brake charts, a colored track map overlay and lap summary statistics.

## Notes

- This project is intentionally educational and keeps the architecture simple.
- Real-time telemetry is not included.
- Multi-driver comparison, lap comparison, delta time and strategy analysis are not included.
