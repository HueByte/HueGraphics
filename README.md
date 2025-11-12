# HueGraphics

<div align="center">
  <img src="https://cdn.voidcube.cloud/assets/hue_pfp.png" alt="HueGraphics Logo" width="200"/>

  **Interactive 3D Point Cloud Visualization Platform**

  Upload, process, and explore 3D models with stunning visual effects powered by Three.js

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

---

## Features

- **3D Point Cloud Rendering** - Interactive WebGL-based visualization with Three.js
- **Kinect v2 Live Streaming** - Real-time point cloud capture and visualization via SignalR WebSocket
- **EPT Format Support** - Efficient point cloud rendering using Entwine Point Tiles
- **Camera Controls** - Smooth orbit, pan, and zoom controls with camera-controls library
- **Dynamic Animations** - Chaotic morph-in effects and floating animations
- **Detail Level Control** - Adjustable point density for performance optimization
- **Model Upload API** - Upload 3D models (OBJ, FBX, GLTF, etc.) with automatic processing
- **Clean Architecture** - .NET 10 backend with domain-driven design
- **Rust Model Parser** - High-performance 3D model to point cloud conversion
- **Eidolon Line Theme** - Cyberpunk-inspired dark theme with crimson/purple/pink palette
- **Docker Support** - Full containerization with nginx routing

## Project Structure

```
.
├── src/
│   ├── client/                    # React web application
│   ├── backend/                   # ASP.NET Core API (.NET 10)
│   ├── kinect-bridge/             # Kinect v2 bridge (.NET Framework 4.8)
│   └── model_parser/              # Rust CLI tool
├── scripts/                       # Development and utility scripts
│   ├── run-dev.sh
│   ├── run-dev.bat
│   ├── start-dev.sh
│   └── start-dev.ps1
├── docs/                          # Public documentation
│   ├── GETTING_STARTED.md
│   ├── KINECT_SETUP.md
│   └── START_DEV.md
├── .dev-local/                    # Internal development docs (gitignored)
│   ├── STYLING_GUIDE.md
│   └── upload-models.ps1
└── pointcloud-data/               # Generated point cloud data
```

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **.NET 10 SDK** (LTS)
- **.NET Framework 4.8** (for Kinect bridge, Windows only)
- **Rust** 1.70+ and Cargo (for model parser)
- **Docker** and Docker Compose (for containerized deployment)

### Documentation

- **[Getting Started](docs/GETTING_STARTED.md)** - Comprehensive setup guide
- **[Kinect Setup](docs/KINECT_SETUP.md)** - Kinect v2 integration guide
- **[Start Dev](docs/START_DEV.md)** - Quick development startup guide

### Local Development

#### 1. Frontend Setup

```bash
cd src/client

# Create environment configuration for development
cp .env.example .env.development
# Edit .env.development and set:
# VITE_API_BASE_URL=http://localhost:5000/api

npm install
npm run dev
```

Frontend will run on `http://localhost:5173`

**Environment Variables:**

- `VITE_API_BASE_URL`: API endpoint URL
  - Development: `http://localhost:5000/api` (create `.env.development`)
  - Production: `/api` (create `.env.production`, relative path for nginx routing)

#### 2. Backend Setup

```bash
cd src/backend/HueGraphics.API

# Copy example config and configure DataPath
cp appsettings.example.json appsettings.json
# Edit appsettings.json and set DataPath to your point cloud data directory

dotnet restore
dotnet run
```

Backend will run on `http://localhost:5000` (Swagger at `/swagger`)

#### 3. Model Parser Setup

```bash
cd src/model_parser
cargo build --release

# Run parser
cargo run -- -i input_model.obj -o output_directory
```

### Docker Deployment

#### Build and Run with Docker Compose

```bash
# Build all containers
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at `http://localhost:8080`

- Frontend: `http://localhost:8080/`
- API: `http://localhost:8080/api/`

### Environment Variables

Create a `.env` file in the root directory:

```env
# Point Cloud Data Path
POINTCLOUD_DATA_PATH=/path/to/pointcloud-data

# Upload Authentication
UPLOAD_API_KEY=your-secret-api-key-here
```

## API Endpoints

### Point Cloud Endpoints

- `GET /api/pointcloud` - List all point clouds
- `GET /api/pointcloud/{id}/metadata` - Get point cloud metadata
- `GET /api/pointcloud/{id}/ept-metadata` - Get EPT metadata
- `GET /api/pointcloud/{id}/ept-tiles/{tileName}` - Get EPT tile data

### Upload Endpoint (Authenticated)

- `POST /api/pointcloud/upload` - Upload 3D model for processing
  - **Headers**: `X-API-Key: your-secret-api-key`
  - **Body**: `multipart/form-data` with ZIP file containing 3D model
  - **Form Fields**:
    - `file`: ZIP archive containing 3D model
    - `name`: Model name (optional)
    - `description`: Model description (optional)

#### Upload Example

```bash
curl -X POST http://localhost:8080/api/pointcloud/upload \
  -H "X-API-Key: your-secret-api-key" \
  -F "file=@model.zip" \
  -F "name=My Model" \
  -F "description=Test model upload"
```

## Point Cloud Data Structure

```
{DataPath}/
└── pointcloud-data/
    ├── model-id-1/
    │   ├── ept.json
    │   ├── ept-hierarchy/
    │   └── ept-data/
    │       └── 0-0-0-0.bin
    └── model-id-2/
        ├── ept.json
        └── ...
```

## Model Parser Usage

The Rust model parser converts 3D models to point cloud format:

```bash
model_parser -i input_model.obj -o output_directory
```

**Supported Formats:**

- OBJ
- FBX
- GLTF/GLB
- STL
- PLY
- 3DS
- And many more (via Assimp)

## Point Cloud Controls

- **Orbit**: Left-click + drag
- **Pan**: Right-click + drag
- **Zoom**: Scroll wheel
- **Detail Level**: Adjust slider to control point density
- **Animation**: Toggle floating animation effect

## Production Deployment

### Nginx Configuration

When deploying to a VPS, configure your main nginx to proxy to the containerized application:

```nginx
server {
    listen 80;
    server_name huegraphics.yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Technologies

### Frontend

- **React 18** - Modern UI framework
- **Vite** - Lightning-fast build tool
- **Three.js** - 3D graphics rendering
- **camera-controls** - Advanced camera manipulation
- **React Router v6** - Client-side routing

### Backend

- **.NET 10** - High-performance web API (LTS)
- **SignalR** - Real-time WebSocket communication
- **Clean Architecture** - Separation of concerns
- **EPT Support** - Binary point cloud format

### Kinect Integration

- **.NET Framework 4.8** - Bridge for Kinect SDK v2
- **Microsoft Kinect SDK v2** - Hardware access
- **HTTP/JSON** - Bridge to API communication
- **Configurable Density** - Adjustable point sampling (10%-100%)
- **Depth Gradient** - Optional depth-based coloring

### Model Parser

- **Rust** - High-performance model processing
- **Assimp** - 3D model import library

## Security

- Upload endpoint requires API key authentication via `X-API-Key` header
- Configure strong API key in environment variables
- Point cloud data path should be outside web root
- CORS is configured for production domains

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Author

**HueByte**

- GitHub: [@HueByte](https://github.com/HueByte)

## Acknowledgments

- [Three.js](https://threejs.org/) - 3D graphics library
- [camera-controls](https://github.com/yomotsu/camera-controls) - Camera control library
- [Assimp](https://github.com/assimp/assimp) - 3D model import library
- [Entwine](https://entwine.io/) - Point cloud organization format
