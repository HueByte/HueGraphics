#!/bin/bash

# HueGraphics Development Runner
# Starts both the React client and .NET API in parallel

echo "🚀 Starting HueGraphics development environment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory and move to repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${GREEN}Shutting down servers...${NC}"
    kill 0
}

trap cleanup EXIT

# Start .NET API
echo -e "${BLUE}Starting .NET API...${NC}"
cd "$REPO_ROOT/src/backend/HueGraphics.API"
dotnet run &
API_PID=$!

# Wait a bit for API to start
sleep 2

# Start React client
echo -e "${BLUE}Starting React client...${NC}"
cd "$REPO_ROOT/src/client"
npm run dev &
CLIENT_PID=$!

cd "$REPO_ROOT"

echo -e "${GREEN}✓ Development servers started!${NC}"
echo "  - API: http://localhost:5000 (Swagger: /swagger)"
echo "  - Client: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for both processes
wait
