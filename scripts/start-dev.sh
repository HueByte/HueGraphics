#!/bin/bash
# HueGraphics Development Startup Script (Git Bash / Linux / macOS)
# This script starts both the backend API and frontend SPA

echo -e "\033[36mStarting HueGraphics Development Environment...\033[0m"
echo ""

# Get the script directory (project root)
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# Start Backend API in background
echo -e "\033[32mStarting Backend API on http://localhost:5000...\033[0m"
cd "$PROJECT_ROOT/src/backend/HueGraphics.API"
dotnet run &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start Frontend SPA
echo -e "\033[32mStarting Frontend SPA on http://localhost:3000...\033[0m"
cd "$PROJECT_ROOT/src/client"
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "\033[36mDevelopment servers are running:\033[0m"
echo ""
echo -e "\033[33mBackend API:  http://localhost:5000\033[0m"
echo -e "\033[33mFrontend SPA: http://localhost:3000\033[0m"
echo -e "\033[33mAPI Swagger:  http://localhost:5000/swagger\033[0m"
echo ""
echo -e "\033[90mPress Ctrl+C to stop both servers\033[0m"

# Trap Ctrl+C to kill both processes
trap "echo -e '\n\033[31mStopping servers...\033[0m'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT

# Wait for processes
wait
