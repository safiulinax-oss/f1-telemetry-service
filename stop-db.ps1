$pgCtl = "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"
$dataDir = Join-Path $PSScriptRoot ".pgdata17"

if (-not (Test-Path $dataDir)) {
    throw "PostgreSQL data directory not found: $dataDir"
}

& $pgCtl -D $dataDir stop
