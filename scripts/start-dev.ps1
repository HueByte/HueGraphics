# HueGraphics Development Startup Script
# This script starts both the backend API and frontend SPA in separate windows

Write-Host "Starting HueGraphics Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Get the script directory (project root)
$projectRoot = $PSScriptRoot

# Start Backend API in new window
Write-Host "Starting Backend API on http://localhost:5000..." -ForegroundColor Green
$backendPath = Join-Path $projectRoot "src\backend\HueGraphics.API"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Backend API' -ForegroundColor Cyan; dotnet run"

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start Frontend SPA in new window
Write-Host "Starting Frontend SPA on http://localhost:3000..." -ForegroundColor Green
$frontendPath = Join-Path $projectRoot "src\client"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host 'Frontend SPA' -ForegroundColor Cyan; npm run dev"

Write-Host ""
Write-Host "Development servers are starting..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend API:  http://localhost:5000" -ForegroundColor Yellow
Write-Host "Frontend SPA: http://localhost:3000" -ForegroundColor Yellow
Write-Host "API Swagger:  http://localhost:5000/swagger" -ForegroundColor Yellow
Write-Host ""
Write-Host "Check the new windows for startup logs." -ForegroundColor Gray
Write-Host "Press Ctrl+C in each window to stop the servers." -ForegroundColor Gray
