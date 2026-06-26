& (Join-Path $PSScriptRoot "start-db.ps1")
Set-Location $PSScriptRoot
py -3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
