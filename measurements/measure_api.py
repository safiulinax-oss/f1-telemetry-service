import json
import statistics
import time
import urllib.request
from urllib.error import HTTPError


BASE_URL = "http://127.0.0.1:8000"
REPEATS = 20

ENDPOINTS = [
    ("/seasons", "список сезонов"),
    ("/races?season_id=6", "Гран-при сезона 2023"),
    ("/sessions?race_id=107", "сессии Azerbaijan Grand Prix 2023"),
    ("/session-detail?session_id=534", "пилоты и погодные данные сессии Sprint"),
    ("/laps?session_id=534&driver_id=14", "круги пилота HAM"),
    ("/lap-detail?lap_id=90878", "телеметрия и сводная статистика круга"),
]


def fetch(path: str) -> tuple[float, int, int]:
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(BASE_URL + path, timeout=120) as response:
            body = response.read()
            status = response.status
    except HTTPError as error:
        body = error.read()
        status = error.code

    elapsed_ms = (time.perf_counter() - started) * 1000
    return elapsed_ms, len(body), status


def main() -> None:
    results = []
    for path, description in ENDPOINTS:
        fetch(path)  # warm-up request
        measurements = []
        sizes = []
        statuses = []

        for _ in range(REPEATS):
            elapsed_ms, size_bytes, status = fetch(path)
            measurements.append(elapsed_ms)
            sizes.append(size_bytes)
            statuses.append(status)

        results.append(
            {
                "request": path,
                "description": description,
                "avg_ms": round(statistics.mean(measurements), 3),
                "min_ms": round(min(measurements), 3),
                "max_ms": round(max(measurements), 3),
                "size_kb": round(statistics.mean(sizes) / 1024, 3),
                "status": ",".join(str(item) for item in sorted(set(statuses))),
                "repeats": REPEATS,
            }
        )

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
