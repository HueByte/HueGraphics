# HueGraphics Backend API

ASP.NET Core Web API for serving point cloud data to the React client.

## Architecture

Clean Architecture with three layers:

- **HueGraphics.API** - Web API layer (controllers, middleware)
- **HueGraphics.Core** - Domain models and interfaces
- **HueGraphics.Infrastructure** - Implementation (services, data access)

## Project Structure

```
HueGraphics.API/
├── Controllers/
│   └── PointCloudController.cs    # REST endpoints
├── Properties/
│   └── launchSettings.json
├── appsettings.json
└── Program.cs

HueGraphics.Core/
├── Interfaces/
│   └── IPointCloudService.cs      # Service contracts
└── Models/
    ├── PointCloudMetadata.cs      # Domain models
    ├── Point.cs
    └── EptMetadata.cs

HueGraphics.Infrastructure/
└── Services/
    └── PointCloudService.cs       # File-based implementation
```

## Getting Started

### Prerequisites

- .NET 8 SDK

### Build

```bash
cd src/backend
dotnet build
```

### Run

```bash
cd src/backend/HueGraphics.API
dotnet run
```

The API will start on `http://localhost:5000`

Open `http://localhost:5000/swagger` to see the API documentation.

## API Endpoints

### Get All Point Clouds

```
GET /api/pointcloud
```

Returns list of all available point clouds with metadata.

### Get Point Cloud Metadata

```
GET /api/pointcloud/{id}/metadata
```

Returns metadata for a specific point cloud.

### Get Point Cloud Data (JSON)

```
GET /api/pointcloud/{id}/data
```

Returns full point cloud data (for JSON format only).

### EPT Endpoints

For EPT format point clouds:

```
GET /api/pointcloud/{id}/ept.json               # EPT metadata
GET /api/pointcloud/{id}/ept-data/{tile}        # Binary tile data
GET /api/pointcloud/{id}/ept-hierarchy/{tile}   # Hierarchy JSON
```

## Configuration

Edit `appsettings.json` to configure the point cloud data directory:

```json
{
  "PointCloudSettings": {
    "DataPath": "pointcloud-data"
  }
}
```

## Point Cloud Data Organization

The API expects point cloud data to be organized as follows:

```
pointcloud-data/
├── model-1/
│   ├── pointcloud.json          # JSON format
│   └── (or)
│   ├── ept.json                 # EPT format
│   ├── ept-data/
│   │   └── 0-0-0-0.bin
│   └── ept-hierarchy/
│       └── 0-0-0-0.json
└── model-2/
    └── ...
```

## Generating Point Cloud Data

Use the model_parser Rust CLI to generate point cloud data:

```bash
# JSON format
cd ../model_parser
cargo run --release -- \
  --input model.glb \
  --output ../../pointcloud-data/my-model/pointcloud.json \
  --format json

# EPT format
cargo run --release -- \
  --input model.glb \
  --output ../../pointcloud-data/my-model \
  --format ept \
  --point-count 100000
```

## CORS Configuration

The API is configured to allow requests from:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Alternative port)

Modify `Program.cs` to add additional origins if needed.

## Development

### Add New Endpoints

1. Define interface in `HueGraphics.Core/Interfaces/`
2. Implement in `HueGraphics.Infrastructure/Services/`
3. Add controller action in `HueGraphics.API/Controllers/`

### Run with Hot Reload

```bash
dotnet watch run
```

## Production Deployment

### Build for Production

```bash
dotnet publish -c Release -o ./publish
```

### Run Published Version

```bash
cd publish
dotnet HueGraphics.API.dll
```

## Testing with curl

```bash
# Get all point clouds
curl http://localhost:5000/api/pointcloud

# Get specific metadata
curl http://localhost:5000/api/pointcloud/my-model/metadata

# Get EPT metadata
curl http://localhost:5000/api/pointcloud/my-model/ept.json

# Get EPT tile
curl http://localhost:5000/api/pointcloud/my-model/ept-data/0-0-0-0.bin -o tile.bin
```

## Technologies

- ASP.NET Core 8.0
- Minimal API
- Swagger/OpenAPI
- System.Text.Json

## License

See root LICENSE file.
