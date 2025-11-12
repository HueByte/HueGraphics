# Kinect v2 Setup Guide

## Problem: .NET Framework Compatibility

The official Microsoft.Kinect SDK v2 only works with .NET Framework (not .NET Core/.NET 8). To work around this, we've implemented a **bridge architecture**:

```
Kinect Hardware <--> KinectBridge (.NET Framework 4.8) <--> HueGraphics API (.NET 8)
                          HTTP/JSON
```

## Solution: Kinect Bridge

The **KinectBridge** is a lightweight .NET Framework console app that:

- Connects directly to Kinect v2 hardware using Microsoft.Kinect SDK
- Captures depth + color streams
- Maps them to 3D point clouds with colors
- Exposes data via HTTP API on port 5555

Your .NET 8 API communicates with the bridge via HTTP.

## Installation Steps

### 1. Install Kinect SDK 2.0 Runtime

- Download from: <https://www.microsoft.com/en-us/download/details.aspx?id=44561>
- Install the **Kinect for Windows SDK 2.0**
- Restart your computer

### 2. Connect Kinect Hardware

- Connect Kinect v2 sensor to USB 3.0 port
- Connect power adapter
- Wait for Windows to recognize the device

### 3. Build the Kinect Bridge

```bash
cd src/kinect-bridge
dotnet build
```

The bridge will be built to: `src/kinect-bridge/bin/Debug/net48/KinectBridge.exe`

## Running the System

You need to run **3 processes** for full Kinect functionality:

### Process 1: Kinect Bridge (Required for Kinect)

```bash
cd src/kinect-bridge/bin/Debug/net48
./KinectBridge.exe
```

You should see:

```
======================================
  Kinect v2 Bridge for .NET 8
======================================

[OK] HTTP server started on port 5555
Bridge running on http://localhost:5555

Endpoints:
  GET  http://localhost:5555/status
  POST http://localhost:5555/initialize
  POST http://localhost:5555/start
  POST http://localhost:5555/stop
  GET  http://localhost:5555/frame

Press Ctrl+C to exit
```

### Process 2: Backend API

```bash
cd src/backend/HueGraphics.API
dotnet run
```

### Process 3: Frontend SPA

```bash
cd src/client
npm run dev
```

## Using Kinect Live Capture

1. **Start all 3 processes** (bridge, API, frontend)
2. Open <http://localhost:3000> in your browser
3. Navigate to **"Kinect Live Capture"** in the sidebar
4. Click **"Initialize Sensor"**
   - This tells the bridge to connect to Kinect hardware
   - Check bridge console for initialization logs
5. Click **"Start Streaming"**
   - Point cloud data will stream in real-time
   - Use mouse to rotate/zoom/pan
6. Click **"Stop Streaming"** when done

## Troubleshooting

### Bridge won't start

**Error**: "No Kinect sensor found"

- Ensure Kinect is plugged into USB 3.0 port
- Check Device Manager for "Kinect" devices
- Reinstall Kinect SDK 2.0 Runtime

**Error**: "Port 5555 already in use"

- Kill existing process: `taskkill /F /IM KinectBridge.exe`
- Or run bridge on different port: `KinectBridge.exe 5556`
  - Then update `KinectService.cs` line 30 to match

### API can't connect to bridge

**Error in API logs**: "Cannot connect to KinectBridge at <http://localhost:5555>"

- Ensure bridge is running (check Process 1 above)
- Check firewall isn't blocking localhost:5555
- Try manually: `curl http://localhost:5555/status`

### No point cloud appears

- Check bridge console for frame capture logs
- Verify "Start Streaming" was clicked
- Open browser DevTools (F12) -> Console tab for errors
- Check API logs for polling errors

### Poor performance / low FPS

- Bridge downsamples to every 2nd point by default
- Adjust in `Program.cs` line 357: change `i += 2` to `i += 3` or `i += 4`
- Reduce browser window size
- Close other applications

## Architecture Details

### Data Flow

```
1. Kinect Hardware
   ↓ (USB 3.0)
2. KinectBridge (Port 5555)
   - Captures depth stream (512x424)
   - Captures color stream (1920x1080)
   - Maps depth → 3D points
   - Maps color → points
   ↓ (HTTP JSON)
3. HueGraphics API (Port 5000)
   - Polls bridge every 33ms (~30 FPS)
   - Caches latest frame
   - Serves via SSE stream
   ↓ (Server-Sent Events)
4. React Frontend (Port 3000)
   - Receives frame updates
   - Renders with Three.js
   - Interactive 3D visualization
```

### API Endpoints

**Bridge (Port 5555)**:

- `POST /initialize` - Initialize Kinect sensor
- `POST /start` - Start capturing frames
- `POST /stop` - Stop capturing
- `GET /status` - Get sensor status (FPS, frame count, etc.)
- `GET /frame` - Get latest point cloud frame

**HueGraphics API (Port 5000)**:

- `POST /api/kinect/initialize` - Proxy to bridge
- `POST /api/kinect/start` - Proxy to bridge + start polling
- `POST /api/kinect/stop` - Proxy to bridge + stop polling
- `GET /api/kinect/status` - Get cached status
- `GET /api/kinect/frame` - Get cached frame
- `GET /api/kinect/stream` - SSE stream (not yet fully tested)

## Startup Script

For convenience, create a batch file to start all 3 processes:

**`start-kinect-dev.bat`**:

```batch
@echo off
echo Starting Kinect Development Environment...

start "Kinect Bridge" cmd /k "cd src\kinect-bridge\bin\Debug\net48 && KinectBridge.exe"
timeout /t 2
start "Backend API" cmd /k "cd src\backend\HueGraphics.API && dotnet run"
timeout /t 3
start "Frontend SPA" cmd /k "cd src\client && npm run dev"

echo All processes started!
echo Close the terminal windows to stop.
```

## Performance Notes

The current implementation uses **polling** for frame delivery:

- Frontend polls API every 33ms (~30 FPS)
- API polls bridge every 33ms
- Bridge captures from Kinect hardware continuously
- Total latency: ~66-100ms

This polling approach is simple, reliable, and works well for the bridge architecture.

## Next Steps

- Test with physical Kinect device
- Optimize point cloud downsampling rate (configurable in bridge)
- Add configuration for bridge URL/port
- Add frame recording/playback features
- Consider WebSocket for lower latency (optional optimization)
