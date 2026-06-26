@echo off
setlocal

cd /d "%~dp0"

set "PG_CTL=C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe"
set "DATA_DIR=%~dp0.pgdata17"
set "LOG_FILE=%DATA_DIR%\server.log"

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

echo Starting project database...
"%PG_CTL%" -D "%DATA_DIR%" -l "%LOG_FILE%" -o " -p 55432" start >nul 2>&1

netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if %errorlevel%==0 (
    echo Site is already running on http://127.0.0.1:8000/
    start "" http://127.0.0.1:8000/
    pause
    exit /b 0
)

echo Opening browser...
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://127.0.0.1:8000/"

echo Starting site...
py -3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

pause
