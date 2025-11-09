@echo off
REM HueGraphics Development Runner for Windows
REM Starts both the React client and .NET API in parallel

echo.
echo Starting HueGraphics development environment...
echo.

REM Get the script directory and repo root
set SCRIPT_DIR=%~dp0
set REPO_ROOT=%SCRIPT_DIR%..

REM Start .NET API in new window
echo Starting .NET API...
start "HueGraphics API" cmd /k "cd /d %REPO_ROOT%\src\backend\HueGraphics.API && dotnet run"

REM Wait a bit for API to start
timeout /t 3 /nobreak >nul

REM Start React client in new window
echo Starting React client...
start "HueGraphics Client" cmd /k "cd /d %REPO_ROOT%\src\client && npm run dev"

echo.
echo Development servers started!
echo   - API: http://localhost:5000 (Swagger: /swagger)
echo   - Client: http://localhost:5173
echo.
echo Close the terminal windows to stop the servers.
echo.
