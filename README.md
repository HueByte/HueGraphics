# HueGraphics

Graphics experiments repository with React-based visualizations and point cloud processing.

**[→ Quick Start Guide](GETTING_STARTED.md)**

## Features

- **Eidolon Line Theme** - Cyberpunk-inspired dark theme with crimson/purple/pink palette
- **Cloud Points Visualizer** - Interactive 3D point cloud visualization with morphing shapes
- **Model Parser** - Rust CLI tool to convert 3D models (GLTF/GLB) to point cloud data
- **.NET API** - RESTful API for serving point cloud data to the client
- **EPT Format** - Efficient point cloud streaming for large datasets
- **Responsive Layout** - Top navigation bar and side menu system
- **React Router** - SPA routing with nested layouts

## Project Structure

```
.
├── src/
│   ├── client/                    # React web application
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   └── src/
│   │       ├── components/
│   │       ├── layouts/
│   │       └── pages/
│   ├── backend/                   # ASP.NET Core API
│   │   ├── HueGraphics.sln
│   │   ├── HueGraphics.API/       # Web API project
│   │   ├── HueGraphics.Core/      # Domain models & interfaces
│   │   └── HueGraphics.Infrastructure/  # Services implementation
│   └── model_parser/              # Rust CLI tool
│       ├── Cargo.toml
│       ├── src/
│       │   ├── config.rs
│       │   ├── parser.rs
│       │   ├── point_cloud.rs
│       │   ├── ept.rs
│       │   └── main.rs
│       └── README.md
└── pointcloud-data/               # Generated point cloud data
```

## Getting Started

### 1. React Client

```bash
cd src/client
npm install
npm run dev
```

Open your browser to `http://localhost:5173`.

### 2. Rust Model Parser

Build the CLI tool:

```bash
cd src/model_parser
cargo build --release
```

Convert a 3D model to point cloud:

```bash
# JSON format (simple, good for ≤10k points)
./target/release/model_parser \
  --input model.glb \
  --output ../../pointcloud-data/my-model/pointcloud.json \
  --point-count 5000

# EPT format (optimized for large point clouds)
./target/release/model_parser \
  --input model.glb \
  --output ../../pointcloud-data/my-model \
  --format ept \
  --point-count 100000
```

### 3. .NET API

Run the backend API:

```bash
cd src/backend/HueGraphics.API
dotnet run
```

API will be available at `http://localhost:5000` (Swagger at `/swagger`)

See [src/backend/README.md](src/backend/README.md) for detailed documentation.

## Documentation

- [Backend API](src/backend/README.md) - ASP.NET Core API documentation
- [Model Parser CLI](src/model_parser/README.md) - Detailed CLI usage
- [Streaming Guide](src/model_parser/STREAMING_API.md) - EPT streaming guide
- [Theme Guide](.dev-local/THEME-GUIDE.md) - Eidolon Line theme documentation

## Technologies

### Frontend
- **React 18** - UI library
- **React Router v6** - Client-side routing
- **Three.js** - 3D graphics
- **Vite** - Build tool and dev server

### Backend
- **Rust** - Model parser CLI
- **.NET 8** - RESTful API
- **GLTF parser** - 3D model loading
- **EPT format** - Efficient point cloud streaming

## Workflow

```
3D Model (GLTF/GLB)
    ↓
model_parser CLI (generates EPT/JSON)
    ↓
.NET API (serves point cloud data)
    ↓
React Client (visualizes in Three.js)
```

## License

See [LICENSE](LICENSE) for details.
