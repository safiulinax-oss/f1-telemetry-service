@echo off
setlocal

cd /d "%~dp0"

set "PG_CTL=C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"
set "DATA_DIR=%~dp0.pgdata17"

if not exist "%PG_CTL%" (
    echo PostgreSQL launcher not found:
    echo %PG_CTL%
    pause
    exit /b 1
)

if not exist "%DATA_DIR%" (
    echo PostgreSQL data directory not found:
    echo %DATA_DIR%
    pause
    exit /b 1
)

echo Stopping project database...
"%PG_CTL%" -D "%DATA_DIR%" stop

pause
