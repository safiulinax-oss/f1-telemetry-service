$pgCtl = "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"
$dataDir = Join-Path $PSScriptRoot ".pgdata17"
$logFile = Join-Path $dataDir "server.log"

if (-not (Test-Path $dataDir)) {
    throw "PostgreSQL data directory not found: $dataDir"
}

& $pgCtl -D $dataDir -l $logFile -o " -p 55432" start
